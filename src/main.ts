import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { registerServiceWorker } from './registerServiceWorker'
import './style.css'

createApp(App).use(router).mount('#app')
registerServiceWorker()
