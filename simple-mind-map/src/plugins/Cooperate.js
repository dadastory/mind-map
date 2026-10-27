import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import {
  applyMindMap,
  readMindMap,
  mindMapScope
} from './cooperateDocument.mjs'
import {
  isSameObject,
  simpleDeepClone,
  getType,
  isUndef,
  transformTreeDataToObject,
  transformObjectToTreeData
} from '../utils/index'

// 协同插件
class Cooperate {
  constructor(opt) {
    this.opt = opt
    this.mindMap = opt.mindMap
    // yjs文档
    this.options = opt.pluginOpt || {}
    this.ydoc = this.options.document || new Y.Doc()
    this.localOrigin = {}
    this.applyingRemote = false
    this.onObserve = this.onObserve.bind(this)
    // 共享数据
    this.ymap = null
    // 连接提供者
    this.provider = null
    // 感知数据
    this.awareness = null
    this.currentAwarenessData = []
    this.waitNodeUidMap = {} // 该列表中的uid对应的节点还未渲染完毕
    // 当前的平级对象类型的思维导图数据
    this.currentData = null
    // 用户信息
    this.userInfo = null
    // 绑定事件
    this.bindEvent()
    // 处理实例化时传入的思维导图数据
    if (this.mindMap.opt.data) {
      this.initData(this.mindMap.opt.data)
    }
  }

  // 初始化数据
  initData(data) {
    if (this.ymap) this.ymap.unobserveDeep(this.onObserve)
    this.ymap = mindMapScope(Y, this.ydoc)
    if (!this.ymap.has('nodes')) {
      // External providers must finish their initial sync before attaching.
      if (this.options.document) throw new Error('uninitialized_mindmap')
      applyMindMap(Y, this.ydoc, { after: { root: simpleDeepClone(data) } })
    }
    const initial = readMindMap(Y, this.ydoc)
    this.currentDocument =
      this.options.onDocument?.(simpleDeepClone(initial)) || initial
    this.currentData = transformTreeDataToObject(this.currentDocument.root)
    this.ymap.observeDeep(this.onObserve)
    if (!this.undoManager) {
      this.undoManager = new Y.UndoManager(this.ymap, {
        trackedOrigins: new Set([this.localOrigin])
      })
      this.originalHistoryCommands = {
        BACK: this.mindMap.command.commands.BACK,
        FORWARD: this.mindMap.command.commands.FORWARD
      }
      const history = direction => {
        if (this.mindMap.opt.readonly) return
        this.mindMap.renderer.textEdit.hideEditTextBox()
        this.mindMap.command.originAddHistory()
        this.undoManager.stopCapturing()
        this.undoManager[direction]()
      }
      this.mindMap.command.commands.BACK = [() => history('undo')]
      this.mindMap.command.commands.FORWARD = [() => history('redo')]
      this.historyChanged = () => {
        if (this.emittingHistory || this.historyQueued) return
        this.historyQueued = true
        queueMicrotask(() => {
          this.historyQueued = false
          if (!this.undoManager) return
          this.emittingHistory = true
          const undo = this.undoManager.undoStack.length
          this.mindMap.emit(
            'back_forward',
            undo,
            undo + this.undoManager.redoStack.length + 1
          )
          this.emittingHistory = false
        })
      }
      this.mindMap.on('back_forward', this.historyChanged)
      this.undoManager.on('stack-item-added', this.historyChanged)
      this.undoManager.on('stack-item-popped', this.historyChanged)
    }
  }

  // 获取yjs doc实例
  getDoc() {
    return this.ydoc
  }

  // 设置连接提供者
  setProvider(provider, webrtcProviderConfig = {}) {
    const { roomName, signalingList, ...otherConfig } = webrtcProviderConfig
    this.provider =
      provider ||
      new WebrtcProvider(roomName, this.ydoc, {
        signaling: signalingList,
        ...otherConfig
      })
    this.awareness = this.provider.awareness

    // 监听状态同步事件
    this.onAwareness = this.onAwareness.bind(this)
    this.awareness.on('change', this.onAwareness)
  }

  // 绑定事件
  bindEvent() {
    // 监听思维导图改变
    this.onDataChange = this.onDataChange.bind(this)
    this.mindMap.on('data_change', this.onDataChange)

    // 监听思维导图节点激活事件
    this.onNodeActive = this.onNodeActive.bind(this)
    this.mindMap.on('node_active', this.onNodeActive)

    // 监听思维导图渲染完毕事件
    this.onNodeTreeRenderEnd = this.onNodeTreeRenderEnd.bind(this)
    this.mindMap.on('node_tree_render_end', this.onNodeTreeRenderEnd)

    // 监听设置思维导图数据事件
    this.onSetData = this.onSetData.bind(this)
    this.mindMap.on('set_data', this.onSetData)
  }

  // 解绑事件
  unBindEvent() {
    if (this.ymap) {
      this.ymap.unobserveDeep(this.onObserve)
    }
    this.mindMap.off('data_change', this.onDataChange)
    this.mindMap.off('node_active', this.onNodeActive)
    this.mindMap.off('node_tree_render_end', this.onNodeTreeRenderEnd)
    this.mindMap.off('set_data', this.onSetData)
    this.mindMap.off('back_forward', this.historyChanged)
    if (this.originalHistoryCommands)
      Object.assign(this.mindMap.command.commands, this.originalHistoryCommands)
    this.awareness?.off('change', this.onAwareness)
    this.undoManager?.destroy()
    this.undoManager = null
    if (!this.options.document) this.ydoc.destroy()
  }

  // 数据同步时的处理，更新当前思维导图
  onObserve(events, transaction) {
    if (transaction.origin === this.localOrigin) return
    this.applyingRemote = true
    try {
      const shared = readMindMap(Y, this.ydoc)
      const document =
        this.options.onDocument?.(simpleDeepClone(shared)) || shared
      if (isSameObject(document, this.currentDocument)) return
      const previous = this.currentDocument
      this.currentDocument = document
      this.currentData = transformTreeDataToObject(document.root)
      if (document.layout && document.layout !== this.mindMap.getLayout())
        this.mindMap.setLayout(document.layout, true)
      if (
        document.theme?.template &&
        document.theme.template !== previous.theme?.template
      )
        this.mindMap.setTheme(document.theme.template, true)
      if (
        document.theme?.config &&
        !isSameObject(document.theme.config, previous.theme?.config)
      )
        this.mindMap.setThemeConfig(document.theme.config, true)
      this.mindMap.updateData(document.root)
    } finally {
      this.applyingRemote = false
    }
  }

  onDataChange(data) {
    if (!data || this.applyingRemote || this.mindMap.opt.readonly) return
    this.updateChanges(transformTreeDataToObject(data))
  }

  // Keep the official data_change -> flat diff -> shared update lifecycle.
  updateChanges(data) {
    const beforeCooperateUpdate = this.mindMap.opt.beforeCooperateUpdate
    if (beforeCooperateUpdate) {
      const changed = Object.keys(data)
        .filter(uid => !isSameObject(data[uid], this.currentData[uid]))
        .map(uid => ({ uid, data: data[uid], oldData: this.currentData[uid] }))
      const removed = Object.keys(this.currentData)
        .filter(uid => !data[uid])
        .map(uid => ({ uid, data: this.currentData[uid] }))
      if (changed.length) {
        beforeCooperateUpdate({ type: 'createOrUpdate', list: changed, data })
        changed.forEach(item => {
          data[item.uid] = item.data
        })
      }
      if (removed.length)
        beforeCooperateUpdate({ type: 'delete', list: removed })
    }
    const root = transformObjectToTreeData(data)
    this.syncDocument({ ...this.currentDocument, root })
  }

  syncDocument(document) {
    if (
      this.applyingRemote ||
      this.mindMap.opt.readonly ||
      isSameObject(document, this.currentDocument)
    )
      return
    const before = this.currentDocument
    this.currentDocument = simpleDeepClone(document)
    this.currentData = transformTreeDataToObject(document.root)
    this.undoManager.stopCapturing()
    applyMindMap(Y, this.ydoc, {
      before,
      after: document,
      origin: this.localOrigin
    })
    this.undoManager.stopCapturing()
  }

  // 节点激活状态改变后触发感知数据同步
  onNodeActive(node, nodeList) {
    if (this.options.onPresence) {
      this.options.onPresence(nodeList.map(item => item.uid))
      return
    }
    if (this.userInfo && this.awareness) {
      this.awareness.setLocalStateField(this.userInfo.name, {
        // 用户信息
        userInfo: {
          ...this.userInfo
        },
        // 当前激活的节点id列表
        nodeIdList: nodeList.map(item => {
          return item.uid
        })
      })
    }
  }

  // 节点树渲染完毕事件
  onNodeTreeRenderEnd() {
    Object.keys(this.waitNodeUidMap).forEach(uid => {
      const node = this.mindMap.renderer.findNodeByUid(uid)
      if (node) {
        node.addUser(this.waitNodeUidMap[uid])
      }
    })
    this.waitNodeUidMap = {}
  }

  // 监听思维导图数据的重新设置事件
  onSetData(data) {
    // set_data is a native edit, never an instruction to re-seed a live room.
    this.onDataChange(data)
  }

  // 设置用户信息
  /**
   * {
   *    id: '',     // 必传，用户唯一的id
   *    name: '',   // 用户名称。name和avatar两个只传一个即可，如果都传了，会显示avatar
   *    avatar: '', // 用户头像
   *    color: ''   // 如果没有传头像，那么会以一个圆形来显示名称的第一个字，文字的颜色为白色，圆的颜色可以通过该字段设置
   * }
   **/
  setUserInfo(userInfo) {
    if (
      getType(userInfo) !== 'Object' ||
      isUndef(userInfo.id) ||
      (isUndef(userInfo.name) && isUndef(userInfo.avatar))
    )
      return
    this.userInfo = userInfo || null
  }

  // 监听感知数据同步事件
  onAwareness() {
    const walk = (list, callback) => {
      list.forEach(value => {
        const userName = Object.keys(value)[0]
        if (!userName) return
        const data = value[userName]
        const userInfo = value.user || data?.userInfo
        const nodeIdList = value.mindmap?.nodeIds || data?.nodeIdList
        if (!userInfo || !Array.isArray(nodeIdList)) return
        nodeIdList.forEach(uid => {
          const node = this.mindMap.renderer.findNodeByUid(uid)
          callback(uid, node, userInfo)
        })
      })
    }
    // 清除之前的数据
    walk(this.currentAwarenessData, (uid, node, userInfo) => {
      if (node) {
        node.removeUser(userInfo)
      }
    })
    // 设置当前数据
    const data = Array.from(this.awareness.getStates().values())
    this.currentAwarenessData = data
    this.waitNodeUidMap = {}
    walk(data, (uid, node, userInfo) => {
      // 不显示自己
      if (userInfo.id === this.userInfo?.id) return
      if (node) {
        node.addUser(userInfo)
      } else {
        this.waitNodeUidMap[uid] = userInfo
      }
    })
  }

  // 插件被移除前做的事情
  beforePluginRemove() {
    this.unBindEvent()
  }

  // 插件被卸载前做的事情
  beforePluginDestroy() {
    this.unBindEvent()
  }
}

Cooperate.instanceName = 'cooperate'

export default Cooperate
