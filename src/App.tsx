import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { ProductionShell } from './pages/production/ProductionShell'
import { ProductionDashboard } from './pages/production/Dashboard'
import { ThreadsList } from './pages/production/ThreadsList'
import { NewThread } from './pages/production/NewThread'
import { ReviewDashboard } from './pages/production/ReviewDashboard'
import { ProductionMessages } from './pages/production/Messages'
import { ProductionSettings } from './pages/production/Settings'
import { TalentShell } from './pages/talent/TalentShell'
import { TalentFeed } from './pages/talent/Feed'
import { ThreadDetail } from './pages/talent/ThreadDetail'
import { AuditionStudio } from './pages/talent/AuditionStudio'
import { ScoreCard } from './pages/talent/ScoreCard'
import { MyAuditions } from './pages/talent/MyAuditions'
import { TalentProfile } from './pages/talent/Profile'
import { TalentMore } from './pages/talent/More'
import { RecordHome } from './pages/talent/RecordHome'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth role="production" />}>
            <Route path="/production" element={<ProductionShell />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ProductionDashboard />} />
              <Route path="page" element={<Navigate to="/production/dashboard" replace />} />
              <Route path="threads" element={<ThreadsList />} />
              <Route path="threads/new" element={<NewThread />} />
              <Route path="review" element={<ReviewDashboard />} />
              <Route path="messages" element={<ProductionMessages />} />
              <Route path="settings" element={<ProductionSettings />} />
            </Route>
          </Route>

          <Route element={<RequireAuth role="talent" />}>
            <Route path="/talent" element={<TalentShell />}>
              <Route index element={<Navigate to="feed" replace />} />
              <Route path="feed" element={<TalentFeed />} />
              <Route path="thread/:id" element={<ThreadDetail />} />
              <Route path="audition/:threadId" element={<AuditionStudio />} />
              <Route path="score/:id" element={<ScoreCard />} />
              <Route path="auditions" element={<MyAuditions />} />
              <Route path="record" element={<RecordHome />} />
              <Route path="profile" element={<TalentProfile />} />
              <Route path="more" element={<TalentMore />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
