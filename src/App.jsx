import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Shell from "./Shell.jsx";
import Landing from "./Landing.jsx";
import Login from "./Login.jsx";
import Register from "./Register.jsx";
import Home from "./Home.jsx";
import Profile from "./Profile.jsx";
import Announcements from "./Announcements.jsx";
import Post from "./Post.jsx";
import PostConfirm from "./PostConfirm.jsx";
import PostDetail from "./PostDetail.jsx";
import Messages from "./Messages.jsx";
import Logout from "./Logout.jsx";
import Chat from "./Chat.jsx";
import BanScreen from "./BanScreen.jsx";
import AdminLayout from "./AdminLayout.jsx";
import AgentChat from "./AgentChat.jsx";
import AdminHome from "./AdminHome.jsx";
import AdminUsers from "./AdminUsers.jsx";
import AdminBanned from "./AdminBanned.jsx";
import AdminPosts from "./AdminPosts.jsx";
import AdminLogs from "./AdminLogs.jsx";

// Halaman untuk tamu: kalau sudah login, langsung ke /home
function Guest({ children }) {
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <div className="boot">Memuat...</div>;
  if (session) return <Navigate to="/home" replace />;
  return <div className="page" key={pathname}>{children}</div>;
}

// Hanya akun admin yang boleh masuk panel admin
function AdminOnly({ children }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="boot">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <div className="boot">Memuat...</div>;
  if (profile.role !== "admin") return <Navigate to="/profile" replace />;
  return children;
}

// Halaman layar penuh (tanpa header dan navbar) yang tetap wajib login
function Protected({ children }) {
  const { session, loading, ban } = useAuth();
  if (loading) return <div className="boot">Memuat...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (ban) return <BanScreen />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Guest><Landing /></Guest>} />
      <Route path="/login" element={<Guest><Login /></Guest>} />
      <Route path="/register" element={<Guest><Register /></Guest>} />

      <Route path="/logout" element={<Logout />} />
      <Route path="/agent" element={<AdminOnly><AgentChat /></AdminOnly>} />

      <Route path="/admin" element={<AdminOnly><AdminLayout /></AdminOnly>}>
        <Route index element={<AdminHome />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="banned" element={<AdminBanned />} />
        <Route path="posts" element={<AdminPosts />} />
        <Route path="logs" element={<AdminLogs />} />
      </Route>

      <Route path="/chat/:username" element={<Protected><Chat /></Protected>} />

      <Route path="/post/confirm" element={<Protected><PostConfirm /></Protected>} />
      <Route path="/post/detail" element={<Protected><PostDetail /></Protected>} />

      <Route element={<Shell />}>
        <Route path="/home" element={<Home />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/post" element={<Post />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/u/:username" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
