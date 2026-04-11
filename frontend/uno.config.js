import { defineConfig, presetAttributify, presetIcons, presetUno } from 'unocss'

export default defineConfig({
  presets: [presetUno(), presetAttributify(), presetIcons()],
  theme: {
    colors: {
      brand: {
        ink: '#102a43',
        gold: '#f0b429',
        mist: '#f5f1e8',
      },
    },
  },
})
