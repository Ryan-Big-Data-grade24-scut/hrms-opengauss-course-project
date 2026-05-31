import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true } },
    {
      path: '/',
      component: () => import('@/views/MainLayout.vue'),
      children: [
        { path: '', redirect: '/attrition' },
        { path: '/attrition', name: 'attrition', component: () => import('@/views/attrition/index.vue') },
        { path: '/talent', name: 'talent', component: () => import('@/views/talent/index.vue') },
        { path: '/org', name: 'org', component: () => import('@/views/org/index.vue') },
        { path: '/profile', name: 'profile', component: () => import('@/views/profile/index.vue') },
        { path: '/settings', name: 'settings', component: () => import('@/views/settings/index.vue') },
        { path: '/employees', name: 'employees', component: () => import('@/views/employees/index.vue') },
        { path: '/departments', name: 'departments', component: () => import('@/views/departments/index.vue') },
        { path: '/leaves', name: 'leaves', component: () => import('@/views/leaves/index.vue') },
        { path: '/users', name: 'users', component: () => import('@/views/users/index.vue') },
        { path: '/audits', name: 'audits', component: () => import('@/views/audits/index.vue') },
      ]
    }
  ]
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.meta?.guestOnly && token) return '/attrition'
  if (!to.meta?.guestOnly && !token) return '/login'
})

export default router
