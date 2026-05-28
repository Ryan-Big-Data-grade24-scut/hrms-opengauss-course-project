import { createRouter, createWebHistory } from 'vue-router'

import { getToken } from '../services/session'

const AppLayout = () => import('../layouts/AppLayout.vue')
const LoginView = () => import('../views/LoginView.vue')
const DashboardView = () => import('../views/DashboardView.vue')
const EmployeesView = () => import('../views/EmployeesView.vue')
const DepartmentsView = () => import('../views/DepartmentsView.vue')
const LeavesView = () => import('../views/LeavesView.vue')
const ProfileView = () => import('../views/ProfileView.vue')
const AuditLogView = () => import('../views/AuditLogView.vue')
const UserManagementView = () => import('../views/UserManagementView.vue')
const LocationsView = () => import('../views/LocationsView.vue')
const JobsView = () => import('../views/JobsView.vue')
const OrgChartView = () => import('../views/OrgChartView.vue')
const DirectoryView = () => import('../views/DirectoryView.vue')

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
          name: 'dashboard',
          component: DashboardView,
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
        {
          path: '/audits',
          name: 'audits',
          component: AuditLogView,
        },
        {
          path: '/users',
          name: 'users',
          component: UserManagementView,
        },
        {
          path: '/locations',
          name: 'locations',
          component: LocationsView,
        },
        {
          path: '/jobs',
          name: 'jobs',
          component: JobsView,
        },
        {
          path: '/org-chart',
          name: 'org-chart',
          component: OrgChartView,
        },
        {
          path: '/directory',
          name: 'directory',
          component: DirectoryView,
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
