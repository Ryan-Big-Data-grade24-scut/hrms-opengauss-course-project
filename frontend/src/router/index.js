import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '../services/session'

const AppLayout = () => import('../layouts/AppLayout.vue')
const LoginView = () => import('../views/LoginView.vue')
const AttritionView = () => import('../views/AttritionView.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { guestOnly: true },
    },
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', redirect: '/attrition' },
        { path: '/attrition', name: 'attrition', component: AttritionView },
        {
          path: '/talent',
          name: 'talent',
          component: () => import('../views/TalentView.vue'),
        },
        {
          path: '/org',
          name: 'org',
          component: () => import('../views/OrgPanoramaView.vue'),
        },
        {
          path: '/profile',
          name: 'profile',
          component: () => import('../views/ProfileView.vue'),
        },
        {
          path: '/settings',
          name: 'settings',
          component: () => import('../views/SettingsView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const token = getToken()
  if (to.meta.guestOnly && token) return '/attrition'
  if (!to.meta.guestOnly && !token) return '/login'
  return true
})

export default router
