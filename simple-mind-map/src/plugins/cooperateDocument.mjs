// Native Cooperate serialization. Yjs is injected so providers and server codecs
// use the same Yjs instance. A flat node index retains the official plugin model;
// nested shared fields/child lists avoid replacing a parent's concurrent edits.
const clone = value => JSON.parse(JSON.stringify(value))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const object = value =>
  value && typeof value === 'object' && !Array.isArray(value)

export function transformTreeDataToObject(root) {
  const result = {}
  const pending = [{ node: root, parent: null }]
  while (pending.length) {
    const { node, parent } = pending.pop()
    const uid = node?.data?.uid
    if (typeof uid !== 'string' || !uid || result[uid])
      throw new Error('invalid_node_uid')
    const { children = [], data, ...attributes } = node
    if (!Array.isArray(children)) throw new Error('invalid_document')
    result[uid] = {
      isRoot: parent === null,
      data: clone(data),
      children: children.map(child => child.data.uid),
      attributes: clone(attributes)
    }
    for (let index = children.length - 1; index >= 0; index--)
      pending.push({ node: children[index], parent: uid })
  }
  return result
}

export function transformObjectToTreeData(data) {
  const uids = Object.keys(data).sort()
  const rootId = uids.find(uid => data[uid].isRoot)
  if (!rootId) return null
  // A concurrent move can leave two parents, a cycle, or an orphan after its
  // destination was deleted. Project deterministically without mutating Yjs:
  // select the first parent, visit once, and recover live unreachable branches
  // below the root. Missing references never create holes in native children.
  const parent = new Map()
  for (const uid of uids)
    for (const child of data[uid].children || []) {
      if (
        child !== rootId &&
        child !== uid &&
        data[child] &&
        !parent.has(child)
      )
        parent.set(child, uid)
    }
  const make = uid => ({
    ...clone(data[uid].attributes || {}),
    data: clone(data[uid].data),
    children: []
  })
  const root = make(rootId)
  const visited = new Set([rootId])
  const append = (uid, node) => {
    const stack = [{ uid, node }]
    while (stack.length) {
      const current = stack.pop()
      const next = []
      for (const child of data[current.uid].children || []) {
        if (parent.get(child) !== current.uid || visited.has(child)) continue
        visited.add(child)
        const target = make(child)
        current.node.children.push(target)
        next.push({ uid: child, node: target })
      }
      for (let index = next.length - 1; index >= 0; index--)
        stack.push(next[index])
    }
  }
  append(rootId, root)
  for (const uid of uids)
    if (!visited.has(uid)) {
      const node = make(uid)
      visited.add(uid)
      root.children.push(node)
      append(uid, node)
    }
  return root
}

export function mindMapScope(Y, document) {
  return document.getMap('mindmap')
}

function normalize(document, value) {
  const native = clone(typeof value === 'string' ? JSON.parse(value) : value)
  const result = native?.root ? native : { root: native }
  if (!object(result.root?.data)) throw new Error('invalid_document')
  // Earlier host templates emitted an empty view, which native View cannot load.
  if (object(result.view) && Object.keys(result.view).length === 0)
    delete result.view
  const stack = [result.root]
  const seen = new Set()
  let serial = 0
  while (stack.length) {
    const node = stack.pop()
    if (
      !object(node?.data) ||
      (node.children !== undefined && !Array.isArray(node.children))
    )
      throw new Error('invalid_document')
    if (!node.data.uid) node.data.uid = `smm-${document.clientID}-${++serial}`
    if (typeof node.data.uid !== 'string' || seen.has(node.data.uid))
      throw new Error('invalid_node_uid')
    seen.add(node.data.uid)
    for (const child of node.children || []) stack.push(child)
  }
  return result
}

function setFields(Y, map, before = {}, after = {}) {
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[key], after[key])) continue
    if (!Object.hasOwn(after, key)) {
      map.delete(key)
      continue
    }
    if (object(after[key])) {
      let nested = map.get(key)
      if (!(nested instanceof Y.Map)) {
        nested = new Y.Map()
        map.set(key, nested)
      }
      setFields(Y, nested, object(before[key]) ? before[key] : {}, after[key])
    } else map.set(key, clone(after[key]))
  }
}

function updateChildren(list, before, after) {
  // Delete only elements removed/moved by this editor, preserving insertions
  // received from other clients since the editor's previous native snapshot.
  const desired = new Set(after)
  const retained = before.filter(uid => desired.has(uid))
  const positions = new Map(retained.map((uid, index) => [uid, index]))
  let previous = -1
  const stable = new Set()
  for (const uid of after) {
    const index = positions.get(uid) ?? -1
    if (index > previous) {
      stable.add(uid)
      previous = index
    }
  }
  const removed = new Set(
    before.filter(uid => !desired.has(uid) || !stable.has(uid))
  )
  for (let index = list.length - 1; index >= 0; index--)
    if (removed.has(list.get(index))) list.delete(index, 1)
  const current = list.toArray()
  const existing = new Set(current)
  let cursor = 0,
    position = 0,
    pending = []
  const flush = () => {
    if (!pending.length) return
    list.insert(position, pending)
    position += pending.length
    pending = []
  }
  for (const uid of after) {
    if (!existing.has(uid)) {
      pending.push(uid)
      continue
    }
    flush()
    while (cursor < current.length && current[cursor] !== uid) {
      cursor++
      position++
    }
    cursor++
    position++
  }
  flush()
}

export function applyMindMap(Y, document, { before, after, origin }) {
  const scope = mindMapScope(Y, document)
  const oldFlat = before?.root ? transformTreeDataToObject(before.root) : {}
  const flat = transformTreeDataToObject(after.root)
  const parentIndex = data => {
    const result = new Map()
    for (const [uid, node] of Object.entries(data))
      for (const child of node.children) result.set(child, uid)
    return result
  }
  const oldParents = parentIndex(oldFlat),
    parents = parentIndex(flat)
  const projected = scope.get('nodes')
    ? transformTreeDataToObject(readMindMap(Y, document).root)
    : {}
  document.transact(() => {
    let nodes = scope.get('nodes')
    let metadata = scope.get('metadata')
    if (!nodes) {
      nodes = new Y.Map()
      scope.set('nodes', nodes)
    }
    if (!metadata) {
      metadata = new Y.Map()
      scope.set('metadata', metadata)
    }
    for (const [uid, current] of Object.entries(flat)) {
      const old = oldFlat[uid]
      const moved = oldParents.get(uid) !== parents.get(uid)
      if (same(old, current) && !moved) continue
      let node = nodes.get(uid)
      const missing = !node
      if (!node) {
        node = new Y.Map()
        nodes.set(uid, node)
        node.set('data', new Y.Map())
        node.set('attributes', new Y.Map())
        node.set('children', new Y.Array())
      }
      if (missing || !old || old.isRoot !== current.isRoot)
        node.set('isRoot', current.isRoot)
      setFields(
        Y,
        node.get('data'),
        missing ? undefined : old?.data,
        current.data
      )
      setFields(
        Y,
        node.get('attributes'),
        missing ? undefined : old?.attributes,
        current.attributes
      )
      const children = node.get('children')
      // A user edit to a recovered cycle must not be redirected by a hidden
      // stale edge. Remove only edges hidden by the current safe projection in
      // the structurally edited node; preserve visible concurrent insertions.
      if (moved || !same(old?.children, current.children)) {
        const visible = new Set(projected[uid]?.children || [])
        for (let index = children.length - 1; index >= 0; index--) {
          const child = children.get(index)
          if (!visible.has(child) && !current.children.includes(child))
            children.delete(index, 1)
        }
      }
      updateChildren(
        children,
        missing ? [] : old?.children || [],
        current.children
      )
    }
    for (const uid of Object.keys(oldFlat)) if (!flat[uid]) nodes.delete(uid)
    const { root: oldRoot, ...oldMetadata } = before || {}
    const { root, ...newMetadata } = after
    setFields(Y, metadata, oldMetadata, newMetadata)
    // Known native metadata containers are seeded once by the server. Their
    // first concurrent field edits then share a Map rather than competing Maps.
    if (!before && !metadata.has('config')) metadata.set('config', new Y.Map())
    if (!before && !metadata.has('theme')) metadata.set('theme', new Y.Map())
    if (!before && !metadata.get('theme').has('config'))
      metadata.get('theme').set('config', new Y.Map())
  }, origin)
}

export function readMindMap(Y, document) {
  const scope = mindMapScope(Y, document)
  const nodes = scope.get('nodes')
  if (!nodes) throw new Error('uninitialized_mindmap')
  const root = transformObjectToTreeData(nodes.toJSON())
  if (!root) throw new Error('invalid_document')
  return { ...(scope.get('metadata')?.toJSON() || {}), root }
}

export function initializeMindMap(Y, content) {
  const document = new Y.Doc()
  const native = normalize(document, content)
  applyMindMap(Y, document, { after: native })
  return document
}

export function exportMindMap(Y, document) {
  return JSON.stringify(readMindMap(Y, document))
}
