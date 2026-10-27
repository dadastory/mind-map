<template>
  <div
    class="richTextToolbar"
    ref="richTextToolbar"
    :style="style"
    :class="{ isDark: isDark }"
    @click.stop.passive
    @mousedown.prevent
    v-show="showRichTextToolbar"
  >
    <el-tooltip :content="$t('richTextToolbar.bold')" placement="top">
      <div class="btn" :class="{ active: formatInfo.bold }" @click="toggleBold">
        <span class="icon iconfont iconzitijiacu"></span>
      </div>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.italic')" placement="top">
      <div
        class="btn"
        :class="{ active: formatInfo.italic }"
        @click="toggleItalic"
      >
        <span class="icon iconfont iconzitixieti"></span>
      </div>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.underline')" placement="top">
      <div
        class="btn"
        :class="{ active: formatInfo.underline }"
        @click="toggleUnderline"
      >
        <span class="icon iconfont iconzitixiahuaxian"></span>
      </div>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.strike')" placement="top">
      <div
        class="btn"
        :class="{ active: formatInfo.strike }"
        @click="toggleStrike"
      >
        <span class="icon iconfont iconshanchuxian"></span>
      </div>
    </el-tooltip>

    <el-tooltip
      :content="$t('richTextToolbar.fontFamily')"
      placement="top"
      :disabled="openPopover === 'font'"
    >
      <el-popover
        ref="font"
        placement="bottom-start"
        trigger="click"
        :value="openPopover === 'font'"
        @input="setPopover('font', $event)"
      >
        <div
          class="fontOptionsList customScrollbar"
          :class="{ isDark: isDark }"
          :style="{ maxHeight: menuMaxHeight + 'px' }"
        >
          <div
            class="fontOptionItem"
            v-for="item in fontFamilyList"
            :key="item.value"
            :class="{ active: formatInfo.font === item.value }"
            @click="changeFontFamily(item.value)"
            @mousedown.prevent
          >
            {{ item.name }}
          </div>
        </div>
        <div class="btn" slot="reference">
          <span class="icon iconfont iconxingzhuang-wenzi"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip
      :content="$t('richTextToolbar.fontSize')"
      placement="top"
      :disabled="openPopover === 'size'"
    >
      <el-popover
        ref="size"
        placement="bottom-start"
        trigger="click"
        :value="openPopover === 'size'"
        @input="setPopover('size', $event)"
      >
        <div
          class="fontOptionsList customScrollbar"
          :class="{ isDark: isDark }"
          :style="{ maxHeight: menuMaxHeight + 'px' }"
        >
          <div
            class="fontOptionItem"
            v-for="item in fontSizeList"
            :key="item"
            :style="{
              fontSize: item + 'px',
              height: (item < 30 ? 30 : item + 10) + 'px'
            }"
            :class="{ active: formatInfo.size === item + 'px' }"
            @click="changeFontSize(item)"
            @mousedown.prevent
          >
            {{ item }}px
          </div>
        </div>
        <div class="btn" slot="reference">
          <span class="icon iconfont iconcase fontColor"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip
      :content="$t('richTextToolbar.color')"
      placement="top"
      :disabled="openPopover === 'color'"
    >
      <el-popover
        ref="color"
        placement="bottom-start"
        trigger="click"
        :value="openPopover === 'color'"
        @input="setPopover('color', $event)"
      >
        <Color :color="fontColor" @change="changeFontColor"></Color>
        <div class="btn" slot="reference" :style="{ color: formatInfo.color }">
          <span class="icon iconfont iconzitiyanse"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip
      :content="$t('richTextToolbar.backgroundColor')"
      :disabled="openPopover === 'background'"
      placement="top"
    >
      <el-popover
        ref="background"
        placement="bottom-start"
        trigger="click"
        :value="openPopover === 'background'"
        @input="setPopover('background', $event)"
      >
        <Color
          :color="fontBackgroundColor"
          @change="changeFontBackgroundColor"
        ></Color>
        <div class="btn" slot="reference">
          <span class="icon iconfont iconbeijingyanse"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip
      :content="$t('richTextToolbar.textAlign')"
      placement="top"
      :disabled="openPopover === 'align'"
    >
      <el-popover
        ref="align"
        placement="bottom-start"
        trigger="click"
        :value="openPopover === 'align'"
        @input="setPopover('align', $event)"
      >
        <div
          class="fontOptionsList customScrollbar"
          :class="{ isDark: isDark }"
          :style="{ maxHeight: menuMaxHeight + 'px' }"
        >
          <div
            class="fontOptionItem"
            v-for="item in alignList"
            :key="item.value"
            :class="{ active: formatInfo.align === item.value }"
            @click="changeTextAlign(item.value)"
            @mousedown.prevent
          >
            {{ item.name }}
          </div>
        </div>
        <div class="btn" slot="reference">
          <span class="icon iconfont iconjuzhongduiqi"></span>
        </div>
      </el-popover>
    </el-tooltip>

    <el-tooltip :content="$t('richTextToolbar.removeFormat')" placement="top">
      <div class="btn" @click="removeFormat">
        <span class="icon iconfont iconqingchu"></span>
      </div>
    </el-tooltip>
  </div>
</template>

<script>
import { fontFamilyList, fontSizeList, alignList } from '@/config'
import Color from './Color.vue'
import { mapState } from 'vuex'

export default {
  components: {
    Color
  },
  props: {
    mindMap: {
      type: Object
    }
  },
  data() {
    return {
      fontSizeList,
      showRichTextToolbar: false,
      style: {
        left: 0,
        top: 0
      },
      fontColor: '',
      fontBackgroundColor: '',
      formatInfo: {},
      openPopover: null,
      menuMaxHeight: 256
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark
    }),

    fontFamilyList() {
      return fontFamilyList[this.$i18n.locale] || fontFamilyList.zh
    },

    alignList() {
      return alignList[this.$i18n.locale] || alignList.zh
    }
  },
  created() {
    this.$bus.$on('rich_text_selection_change', this.onRichTextSelectionChange)
  },
  mounted() {
    document.body.append(this.$refs.richTextToolbar)
  },
  beforeDestroy() {
    this.$bus.$off('rich_text_selection_change', this.onRichTextSelectionChange)
    this.$refs.richTextToolbar.remove()
  },
  methods: {
    setPopover(name, visible) {
      if (!visible) {
        if (this.openPopover === name) this.openPopover = null
        return
      }
      const popover = this.$refs[name]
      const reference = popover.referenceElm.getBoundingClientRect()
      const style = getComputedStyle(popover.$refs.popper)
      const chrome =
        [
          'paddingTop',
          'paddingBottom',
          'borderTopWidth',
          'borderBottomWidth'
        ].reduce((sum, key) => sum + (parseFloat(style[key]) || 0), 0) +
        Math.max(
          parseFloat(style.marginTop) || 0,
          parseFloat(style.marginBottom) || 0
        )
      const available = Math.max(
        reference.top,
        window.innerHeight - reference.bottom
      )
      this.menuMaxHeight = Math.max(0, Math.min(256, available - chrome - 8))
      this.openPopover = name
      this.$nextTick(() => popover.updatePopper())
    },

    onRichTextSelectionChange(hasRange, rect, formatInfo) {
      if (hasRange) {
        this.style.left = rect.left + rect.width / 2 + 'px'
        this.style.top = rect.top - 60 + 'px'
        this.formatInfo = { ...(formatInfo || {}) }
        this.$nextTick(() => {
          if (!this.showRichTextToolbar) return
          const toolbar = this.$refs.richTextToolbar.getBoundingClientRect()
          const left = Math.max(
            toolbar.width / 2 + 8,
            Math.min(
              window.innerWidth - toolbar.width / 2 - 8,
              rect.left + rect.width / 2
            )
          )
          const above = rect.top - toolbar.height - 8
          const top = above >= 8 ? above : rect.bottom + 8
          this.style.left = left + 'px'
          this.style.top =
            Math.max(
              8,
              Math.min(window.innerHeight - toolbar.height - 8, top)
            ) + 'px'
        })
      }
      this.showRichTextToolbar = hasRange
      if (!hasRange) this.openPopover = null
    },

    toggleBold() {
      this.formatInfo.bold = !this.formatInfo.bold
      this.mindMap.richText.formatText({
        bold: this.formatInfo.bold
      })
    },

    toggleItalic() {
      this.formatInfo.italic = !this.formatInfo.italic
      this.mindMap.richText.formatText({
        italic: this.formatInfo.italic
      })
    },

    toggleUnderline() {
      this.formatInfo.underline = !this.formatInfo.underline
      this.mindMap.richText.formatText({
        underline: this.formatInfo.underline
      })
    },

    toggleStrike() {
      this.formatInfo.strike = !this.formatInfo.strike
      this.mindMap.richText.formatText({
        strike: this.formatInfo.strike
      })
    },

    changeFontFamily(font) {
      this.openPopover = null
      this.formatInfo.font = font
      this.mindMap.richText.formatText({
        font
      })
    },

    changeFontSize(size) {
      this.openPopover = null
      this.formatInfo.size = size
      this.mindMap.richText.formatText({
        size: size + 'px'
      })
    },

    changeFontColor(color) {
      this.formatInfo.color = color
      this.mindMap.richText.formatText({
        color
      })
    },

    changeFontBackgroundColor(background) {
      this.formatInfo.background = background
      this.mindMap.richText.formatText({
        background
      })
    },

    changeTextAlign(align) {
      this.openPopover = null
      this.formatInfo.align = align
      this.mindMap.richText.formatText({
        align
      })
    },

    removeFormat() {
      this.mindMap.richText.removeFormat()
    }
  }
}
</script>

<style lang="less" scoped>
.richTextToolbar {
  position: fixed;
  z-index: 2000;
  width: max-content;
  max-width: calc(100vw - 16px);
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.06);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  transform: translateX(-50%);

  > * {
    flex: 0 0 auto;
  }

  &.isDark {
    background: #363b3f;

    .btn {
      color: #fff;

      &:hover {
        background: hsla(0, 0%, 100%, 0.05);
      }
    }
  }

  .btn {
    width: 55px;
    height: 55px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;

    &:hover {
      background-color: #eefbed;
    }

    &.active {
      color: #12bb37;
    }

    .icon {
      font-size: 20px;

      &.fontColor {
        font-size: 26px;
      }
    }
  }
}

.fontOptionsList {
  width: 200px;
  max-width: calc(100vw - 48px);
  max-height: 256px;
  overflow-y: auto;
  overscroll-behavior: contain;

  &.isDark {
    .fontOptionItem {
      color: #fff;

      &:hover {
        background-color: hsla(0, 0%, 100%, 0.05);
      }
    }
  }

  .fontOptionItem {
    height: 30px;
    width: 100%;
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &:hover {
      background-color: #f7f7f7;
    }

    &.active {
      color: #12bb37;
    }
  }
}
</style>
