import { createRouter, createWebHistory } from 'vue-router'

import { getToken } from '../services/session'

const AppLayout = () => import('../layouts/AppLayout.vue')
const LoginView = () => import('../views/LoginView.vue')
const EmployeesView = () => import('../views/EmployeesView.vue')
const DepartmentsView = () => import('../views/DepartmentsView.vue')
const LeavesView = () => import('../views/LeavesView.vue')
const ProfileView = () => import('../views/ProfileView.vue')

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
        {
          path: '',
          redirect: '/employees',
        },
        {
          path: '/employees',
          name: 'employees',
          component: EmployeesView,
        },
        {
          path: '/departments',
          name: 'departments',
          component: DepartmentsView,
        },
        {
          path: '/leaves',
          name: 'leaves',
          component: LeavesView,
        },
        {
          path: '/profile',
          name: 'profile',
          component: ProfileView,
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const token = getToken()

  if (to.meta.guestOnly && token) {
    return '/employees'
  }

  if (!to.meta.guestOnly && !token) {
    return '/login'
  }

  return true
})

export default router
