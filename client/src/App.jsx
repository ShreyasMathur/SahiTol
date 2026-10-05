import { Link, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { RequireAuth, RequirePermission } from './components/auth/RequirePermission.jsx';
import { EmptyState } from './components/ui/Feedback.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { RecordEditorPage } from './pages/RecordEditorPage.jsx';
import { RecordDetailPage } from './pages/RecordDetailPage.jsx';
import { RepositoryPage } from './pages/RepositoryPage.jsx';
import { TestEntryPage } from './pages/TestEntryPage.jsx';
import { WeightsPage } from './pages/WeightsPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { VerifyPage } from './pages/VerifyPage.jsx';
import { SetupPage } from './pages/SetupPage.jsx';
import { ActivatePage } from './pages/ActivatePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/activate/:token" element={<ActivatePage />} />
      <Route path="/verify/:id" element={<VerifyPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="repository" element={<RepositoryPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="records/:id" element={<RecordDetailPage />} />
          <Route path="records/:id/tests/:testType" element={<TestEntryPage />} />
          <Route element={<RequirePermission permission="record:create" />}>
            <Route path="records/new" element={<RecordEditorPage />} />
          </Route>
          <Route element={<RequirePermission permission="record:edit" />}>
            <Route path="records/:id/edit" element={<RecordEditorPage />} />
          </Route>
          <Route element={<RequirePermission permission="weights:view" />}>
            <Route path="weights" element={<WeightsPage />} />
          </Route>
          <Route element={<RequirePermission permission="users:manage" />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route
            path="*"
            element={
              <EmptyState title="Page not found">
                <Link to="/" className="text-brand-700 hover:underline">Back to dashboard</Link>
              </EmptyState>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
