import { useLanguage } from "../contexts/LanguageContext"
import { Calendar, Users, Ticket } from "lucide-react"

export function About() {
  const { t } = useLanguage()
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <section className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">{t("About EventFlow")}</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("The all-in-one event management platform that makes creating, managing, and attending events effortless.")}
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-8 mb-16">
        <div>
          <h2 className="text-2xl font-bold mb-4">{t("Our Mission")}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t("EventFlow was built to simplify event management for everyone. Whether you're organizing a\n            small workshop or a large conference, our platform provides the tools you need to succeed.\n            We believe that great events start with great organization.")}
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-4">{t("What We Offer")}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t("From event creation and registration to ticketing and attendance tracking, EventFlow\n            provides a complete suite of tools. Our platform supports multiple user roles, real-time\n            notifications, and detailed analytics to help you understand your events better.")}
          </p>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-6 mb-16">
        {[
          { icon: Calendar, title: t("Easy Event Creation"), desc: "Create and publish events in minutes with our intuitive interface." },
          { icon: Users, title: t("Role-Based Access"), desc: "Admin, organizer, and attendee roles with tailored experiences." },
          { icon: Ticket, title: t("Digital Ticketing"), desc: "Generate unique QR-coded tickets for every registration." },
        ].map((item) => (
          <div key={item.title} className="text-center p-6 rounded-xl border border-border bg-card">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <item.icon className="text-primary" size={24} />
            </div>
            <h3 className="font-semibold mb-2">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
