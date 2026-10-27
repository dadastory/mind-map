<template>
  <el-dialog
    class="nodeImageDialog"
    :title="$t('nodeImage.title')"
    :visible.sync="dialogVisible"
    :width="isMobile ? '90%' : '600px'"
    top="0"
    @close="reset"
  >
    <el-button v-if="imagePicker" :loading="picking" @click="chooseHostImage">
      {{ imagePicker.label }}
    </el-button>
    <div v-if="!img" class="title">{{ imagePicker ? imagePicker.localLabel : '方式一' }}</div>
    <ImgUpload
      ref="ImgUpload"
      v-model="img"
      :placeholder="imagePicker && imagePicker.localTip"
      style="margin-bottom: 12px;"
    ></ImgUpload>
    <div v-if="!imagePicker" class="title">方式二</div>
    <div v-if="!imagePicker" class="inputBox">
      <span class="label">请输入图片地址</span>
      <el-input
        v-model="imgUrl"
        size="mini"
        placeholder="http://xxx.com/xx.jpg"
        @keydown.native.stop
      ></el-input>
    </div>
    <div class="inputBox">
      <span class="label">{{ $t('nodeImage.imgTitle') }}</span>
      <el-input v-model="imgTitle" size="mini" @keydown.native.stop></el-input>
    </div>
    <span slot="footer" class="dialog-footer">
      <el-button @click="cancel">{{ $t('dialog.cancel') }}</el-button>
      <el-button type="primary" :disabled="picking" @click="confirm">{{
        $t('dialog.confirm')
      }}</el-button>
    </span>
  </el-dialog>
</template>

<script>
import ImgUpload from '@/components/ImgUpload/index.vue'
import { getImageSize, isMobile } from 'simple-mind-map/src/utils/index'

// 节点图片内容设置
export default {
  components: {
    ImgUpload
  },
  data() {
    return {
      dialogVisible: false,
      img: '',
      imgUrl: '',
      imgTitle: '',
      activeNodes: [],
      targetNodeIds: [],
      picking: false,
      pickEpoch: 0,
      isMobile: isMobile()
    }
  },
  computed: {
    imagePicker() {
      return window.takeOverAppMethods && window.takeOverAppMethods.imagePicker
    }
  },
  created() {
    this.$bus.$on('node_active', this.handleNodeActive)
    this.$bus.$on('showNodeImage', this.handleShowNodeImage)
  },
  beforeDestroy() {
    this.reset()
    this.$bus.$off('node_active', this.handleNodeActive)
    this.$bus.$off('showNodeImage', this.handleShowNodeImage)
  },
  methods: {
    handleNodeActive(...args) {
      if (!this.dialogVisible) this.activeNodes = [...args[1]]
    },

    handleShowNodeImage() {
      this.reset()
      if (!this.activeNodes.length) return
      this.targetMindMap = this.activeNodes[0].mindMap
      this.targetNodeIds = this.activeNodes.map(node => node.getData('uid'))
      if (this.activeNodes.length > 0) {
        let firstNode = this.activeNodes[0]
        let img = firstNode.getImageUrl() || ''
        if (img) {
          if (/^https?:\/\//.test(img)) {
            this.imgUrl = img
          } else {
            this.img = img
          }
        }
        this.imgTitle = firstNode.getData('imageTitle') || ''
      }
      this.dialogVisible = true
    },

    cancel() {
      this.dialogVisible = false
      this.reset()
    },

    reset() {
      this.pickEpoch++
      this.picking = false
      if (this.imagePicker && this.imagePicker.cancel) this.imagePicker.cancel()
      this.img = ''
      this.imgTitle = ''
      this.imgUrl = ''
    },

    async chooseHostImage() {
      if (this.picking || !this.imagePicker) return
      const epoch = ++this.pickEpoch
      this.picking = true
      try {
        const selected = await this.imagePicker.pick()
        if (epoch !== this.pickEpoch || !this.dialogVisible || !selected) return
        this.img = selected.url
        this.imgUrl = ''
        this.imgTitle = selected.name
      } catch (error) {
        if (epoch === this.pickEpoch) this.$message.error(this.imagePicker.error)
      } finally {
        if (epoch === this.pickEpoch) this.picking = false
      }
    },

    async confirm() {
      const epoch = ++this.pickEpoch
      const mindMap = this.targetMindMap
      const targetIds = [...this.targetNodeIds]
      try {
        if (mindMap.opt.readonly) return this.cancel()
        const nodes = targetIds
          .map(id => mindMap.renderer.findNodeByUid(id))
          .filter(Boolean)
        // 删除图片
        if (!this.img && !this.imgUrl) {
          this.cancel()
          nodes.forEach(node => {
            node.setImage(null)
          })
          return
        }
        let res = null
        let img = ''
        if (this.img) {
          img = this.img
          res = await this.$refs.ImgUpload.getSize()
        } else if (this.imgUrl) {
          img = this.imgUrl
          res = await getImageSize(img)
        }
        if (epoch !== this.pickEpoch || mindMap.opt.readonly || !this.dialogVisible) return
        // Resolve the captured targets again after image decoding: another
        // participant may have rerendered or deleted a node while picking.
        targetIds.map(id => mindMap.renderer.findNodeByUid(id)).filter(Boolean).forEach(node => {
          node.setImage({
            url: img || 'none',
            title: this.imgTitle,
            width: res.width || 100,
            height: res.height || 100
          })
        })
        this.cancel()
      } catch (error) {
        if (this.imagePicker) this.$message.error(this.imagePicker.error)
        else console.log(error)
      }
    }
  }
}
</script>

<style lang="less" scoped>
.nodeImageDialog {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;

  ::v-deep .el-dialog {
    display: flex;
    flex-direction: column;
    max-width: 100%;
    max-height: 100%;
    margin: 0;
  }

  ::v-deep .el-dialog__body {
    min-height: 0;
    overflow-y: auto;
    padding: 20px;
  }

  ::v-deep .el-dialog__header,
  ::v-deep .el-dialog__footer {
    flex-shrink: 0;
  }

  .title {
    font-size: 14px;
    margin-top: 12px;
    margin-bottom: 12px;
  }

  .inputBox {
    display: flex;
    align-items: center;
    margin-bottom: 10px;

    .label {
      width: 150px;
    }
  }
}
</style>
