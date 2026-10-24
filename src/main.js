import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// Import Bootstrap CSS and JS
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// TradeHappy design system: tokens, Bootstrap re-skin, then our own components (order matters)
import './assets/styles/tokens.css'
import './assets/styles/bootstrap-theme.css'
import './assets/styles/components.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
