import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import MetaPage from './pages/MetaPage.vue'
import DraftPage from './pages/DraftPage.vue'
import CounterPage from './pages/CounterPage.vue'
import PlayerPage from './pages/PlayerPage.vue'
import MapRatesPage from './pages/MapRatesPage.vue'
import MapsPage from './pages/MapsPage.vue'
import MapDetailPage from './pages/MapDetailPage.vue'

export const router = createRouter({
  history:
    import.meta.env.PROD && import.meta.env.BASE_URL !== '/'
      ? createWebHashHistory(import.meta.env.BASE_URL)
      : createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/meta', name: 'meta', component: MetaPage },
    { path: '/draft', name: 'draft', component: DraftPage },
    { path: '/counter/:id?', name: 'counter', component: CounterPage },
    { path: '/player', name: 'player', component: PlayerPage },
    { path: '/maps/winrates', name: 'maprates', component: MapRatesPage },
    { path: '/maps/:id', name: 'map-detail', component: MapDetailPage },
    { path: '/maps', name: 'maps', component: MapsPage },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
