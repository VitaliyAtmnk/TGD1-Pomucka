import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
const LandingPage = lazy(() => import("./pages/Landing").then((m) => ({ default: m.LandingPage })));
const HomePage = lazy(() => import("./pages/Home").then((m) => ({ default: m.HomePage })));

const GlossaryPage = lazy(() => import("./pages/Glossary").then((m) => ({ default: m.GlossaryPage })));
const ChaptersPage = lazy(() => import("./pages/Chapters").then((m) => ({ default: m.ChaptersPage })));
const ChapterPage = lazy(() => import("./pages/Chapters").then((m) => ({ default: m.ChapterPage })));
const ItemPage = lazy(() => import("./pages/ItemPage").then((m) => ({ default: m.ItemPage })));
const ReviewPage = lazy(() => import("./pages/Review").then((m) => ({ default: m.ReviewPage })));
const ExercisesPage = lazy(() => import("./pages/Exercises").then((m) => ({ default: m.ExercisesPage })));
const VisualizerIndex = lazy(() => import("./pages/Visualizer").then((m) => ({ default: m.VisualizerIndex })));
const VisualizerPage = lazy(() => import("./pages/Visualizer").then((m) => ({ default: m.VisualizerPage })));
const ExamPage = lazy(() => import("./pages/Exam").then((m) => ({ default: m.ExamPage })));
const LoginPage = lazy(() => import("./pages/Account").then((m) => ({ default: m.LoginPage })));
const ProfilePage = lazy(() => import("./pages/Account").then((m) => ({ default: m.ProfilePage })));

function NotFound() {
  return <p className="py-10 text-center text-muted">Stránka neexistuje.</p>;
}

const s = (el: React.ReactNode) => <Suspense fallback={<Spinner />}>{el}</Suspense>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={s(<LandingPage />)} />
            <Route path="prehled" element={s(<HomePage />)} />
            <Route path="slovnik" element={s(<GlossaryPage />)} />
            <Route path="kapitoly" element={s(<ChaptersPage />)} />
            <Route path="kapitola/:id" element={s(<ChapterPage />)} />
            <Route path="pojem/:id" element={s(<ItemPage />)} />
            <Route path="opakovani" element={s(<ReviewPage />)} />
            <Route path="priklady" element={s(<ExercisesPage />)} />
            <Route path="vizualizace" element={s(<VisualizerIndex />)} />
            <Route path="vizualizace/:id" element={s(<VisualizerPage />)} />
            <Route path="zkouska" element={s(<ExamPage />)} />
            <Route path="prihlaseni" element={s(<LoginPage />)} />
            <Route path="profil" element={s(<ProfilePage />)} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
