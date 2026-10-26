import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { vReveal, vTilt } from './lib/motion'
import { initTheme } from './lib/theme'

// Import Bootstrap CSS and JS
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// TradeHappy design system: tokens, Bootstrap re-skin, then our own components (order matters)
import './assets/styles/tokens.css'
import './assets/styles/bootstrap-theme.css'
import './assets/styles/components.css'
import './assets/styles/motion.css'

// Light or dark, before anything is drawn
initTheme()

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Motion directives: v-reveal (fade in on scroll) and v-tilt (card leans to the cursor)
app.directive('reveal', vReveal)
app.directive('tilt', vTilt)

app.mount('#app')
