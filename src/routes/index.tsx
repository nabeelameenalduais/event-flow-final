import { lazy, type ComponentType } from "react"
import { createBrowserRouter } from "react-router-dom"
import { AppLayout } from "../components/layout/AppLayout"
import { PublicLayout } from "../components/layout/PublicLayout"
import { ProtectedRoute } from "./ProtectedRoute"
import { PublicRoute } from "./PublicRoute"

/** Route-level code splitting: load a named page component only when needed. */
function namedLazy<T extends Record<string, ComponentType<any>>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(() => loader().then((module) => ({ default: module[name] as ComponentType<any> })))
}

const Home = namedLazy(() => import("../pages/Home"), "Home")
const Events = namedLazy(() => import("../pages/Events"), "Events")
const EventDetail = namedLazy(() => import("../pages/EventDetail"), "EventDetail")
const EventEvaluation = namedLazy(() => import("../pages/EventEvaluation"), "EventEvaluation")
const Login = namedLazy(() => import("../pages/Login"), "Login")
const Register = namedLazy(() => import("../pages/Register"), "Register")
const ForgotPassword = namedLazy(() => import("../pages/ForgotPassword"), "ForgotPassword")
const ResetPassword = namedLazy(() => import("../pages/ResetPassword"), "ResetPassword")
const About = namedLazy(() => import("../pages/About"), "About")
const Contact = namedLazy(() => import("../pages/Contact"), "Contact")
const Dashboard = namedLazy(() => import("../pages/Dashboard"), "Dashboard")
const UserManagement = namedLazy(() => import("../pages/UserManagement"), "UserManagement")
const UserDetail = namedLazy(() => import("../pages/UserDetail"), "UserDetail")
const CategoryManagement = namedLazy(() => import("../pages/CategoryManagement"), "CategoryManagement")
const VenueManagement = namedLazy(() => import("../pages/VenueManagement"), "VenueManagement")
const EventManagement = namedLazy(() => import("../pages/EventManagement"), "EventManagement")
const EventForm = namedLazy(() => import("../pages/EventForm"), "EventForm")
const ScheduleManagement = namedLazy(() => import("../pages/ScheduleManagement"), "ScheduleManagement")
const RegistrationManagement = namedLazy(() => import("../pages/RegistrationManagement"), "RegistrationManagement")
const AttendanceManagement = namedLazy(() => import("../pages/AttendanceManagement"), "AttendanceManagement")
const InvitationManagement = namedLazy(() => import("../pages/InvitationManagement"), "InvitationManagement")
const EventCosts = namedLazy(() => import("../pages/EventCosts"), "EventCosts")
const EvaluationManagement = namedLazy(() => import("../pages/EvaluationManagement"), "EvaluationManagement")
const EventOrganizers = namedLazy(() => import("../pages/EventOrganizers"), "EventOrganizers")
const EventChat = namedLazy(() => import("../pages/EventChat"), "EventChat")
const Profile = namedLazy(() => import("../pages/Profile"), "Profile")
const TicketDetail = namedLazy(() => import("../pages/TicketDetail"), "TicketDetail")
const Notifications = namedLazy(() => import("../pages/Notifications"), "Notifications")
const FileManagement = namedLazy(() => import("../pages/FileManagement"), "FileManagement")
const Reports = namedLazy(() => import("../pages/Reports"), "Reports")
const FeedbackManagement = namedLazy(() => import("../pages/FeedbackManagement"), "FeedbackManagement")
const SystemSettings = namedLazy(() => import("../pages/SystemSettings"), "SystemSettings")
const SecurityCenter = namedLazy(() => import("../pages/SecurityCenter"), "SecurityCenter")
const EventMeeting = namedLazy(() => import("../pages/EventMeeting"), "EventMeeting")
const Bans = namedLazy(() => import("../pages/Bans"), "Bans")
const EventRequestForm = namedLazy(() => import("../pages/EventRequestForm"), "EventRequestForm")
const EventRequests = namedLazy(() => import("../pages/EventRequests"), "EventRequests")
const Finance = namedLazy(() => import("../pages/Finance"), "Finance")
const Audience = namedLazy(() => import("../pages/Audience"), "Audience")
const Campaigns = namedLazy(() => import("../pages/Campaigns"), "Campaigns")
const Broadcast = namedLazy(() => import("../pages/Broadcast"), "Broadcast")
const PasswordResets = namedLazy(() => import("../pages/PasswordResets"), "PasswordResets")
const ChangePassword = namedLazy(() => import("../pages/ChangePassword"), "ChangePassword")
const RestoreAccount = namedLazy(() => import("../pages/RestoreAccount"), "RestoreAccount")
const NotFound = namedLazy(() => import("../pages/NotFound"), "NotFound")

export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <PublicRoute><Home /></PublicRoute> },
      { path: "events", element: <Events /> },
      { path: "events/:id", element: <EventDetail /> },
      { path: "events/:id/evaluate", element: <ProtectedRoute roles={["attendee"]}><EventEvaluation /></ProtectedRoute> },
      { path: "about", element: <PublicRoute><About /></PublicRoute> },
      { path: "contact", element: <PublicRoute><Contact /></PublicRoute> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "forgot-password", element: <ForgotPassword /> },
      { path: "reset-password", element: <ResetPassword /> },
      { path: "restore-account", element: <RestoreAccount /> },
    ],
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "admin/users", element: <ProtectedRoute roles={["admin"]}><UserManagement /></ProtectedRoute> },
      { path: "admin/users/:id", element: <ProtectedRoute roles={["admin"]}><UserDetail /></ProtectedRoute> },
      { path: "admin/categories", element: <ProtectedRoute roles={["admin"]}><CategoryManagement /></ProtectedRoute> },
      { path: "admin/venues", element: <ProtectedRoute roles={["admin"]}><VenueManagement /></ProtectedRoute> },
      { path: "admin/files", element: <ProtectedRoute roles={["admin"]}><FileManagement /></ProtectedRoute> },
      { path: "admin/reports", element: <ProtectedRoute roles={["admin"]}><Reports /></ProtectedRoute> },
      { path: "admin/settings", element: <ProtectedRoute roles={["admin"]}><SystemSettings /></ProtectedRoute> },
      { path: "admin/security", element: <ProtectedRoute roles={["admin"]}><SecurityCenter /></ProtectedRoute> },
      { path: "feedback", element: <ProtectedRoute roles={["organizer", "admin"]}><FeedbackManagement /></ProtectedRoute> },
      { path: "change-password", element: <ChangePassword /> },
      { path: "event-requests", element: <EventRequests /> },
      { path: "event-requests/new", element: <EventRequestForm /> },
      { path: "bans", element: <ProtectedRoute roles={["organizer", "admin"]}><Bans /></ProtectedRoute> },
      { path: "finance", element: <ProtectedRoute roles={["organizer", "admin"]}><Finance /></ProtectedRoute> },
      { path: "audience", element: <Audience /> },
      { path: "campaigns", element: <Campaigns /> },
      { path: "admin/broadcast", element: <ProtectedRoute roles={["admin"]}><Broadcast /></ProtectedRoute> },
      { path: "admin/password-resets", element: <ProtectedRoute roles={["admin"]}><PasswordResets /></ProtectedRoute> },
      { path: "events", element: <ProtectedRoute roles={["organizer", "admin"]}><EventManagement /></ProtectedRoute> },
      { path: "events/new", element: <ProtectedRoute roles={["organizer", "admin"]}><EventForm /></ProtectedRoute> },
      { path: "events/:id/edit", element: <ProtectedRoute roles={["organizer", "admin"]}><EventForm /></ProtectedRoute> },
      { path: "events/:eventId/schedule", element: <ProtectedRoute roles={["organizer", "admin"]}><ScheduleManagement /></ProtectedRoute> },
      { path: "events/:eventId/registrations", element: <ProtectedRoute roles={["organizer", "admin"]}><RegistrationManagement /></ProtectedRoute> },
      { path: "events/:eventId/attendance", element: <ProtectedRoute roles={["organizer", "admin"]}><AttendanceManagement /></ProtectedRoute> },
      { path: "events/:eventId/invitations", element: <ProtectedRoute roles={["organizer", "admin"]}><InvitationManagement /></ProtectedRoute> },
      { path: "events/:eventId/costs", element: <ProtectedRoute roles={["organizer", "admin"]}><EventCosts /></ProtectedRoute> },
      { path: "events/:eventId/evaluation", element: <ProtectedRoute roles={["organizer", "admin"]}><EvaluationManagement /></ProtectedRoute> },
      { path: "events/:eventId/organizers", element: <ProtectedRoute roles={["admin"]}><EventOrganizers /></ProtectedRoute> },
      { path: "events/:eventId/chat", element: <ProtectedRoute roles={["organizer", "admin", "attendee"]}><EventChat /></ProtectedRoute> },
      { path: "events/:eventId/meeting", element: <ProtectedRoute roles={["attendee", "organizer", "admin"]}><EventMeeting /></ProtectedRoute> },
      { path: "profile", element: <Profile /> },
      { path: "tickets/:id", element: <TicketDetail /> },
      { path: "notifications", element: <Notifications /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
])
