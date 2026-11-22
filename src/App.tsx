import { Outlet } from "react-router-dom"
import ChatWidget from "./components/chat/ChatWidget"

export default function App() {
  return (
    <>
      <Outlet />
      <ChatWidget />
    </>
  )
}
