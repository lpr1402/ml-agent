/**
 * Admin Root - Redirect to Dashboard
 */

import { redirect } from 'next/navigation'

export default function AdminPage() {
  redirect('/admin/dashboard')
}
