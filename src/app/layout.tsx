import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Instrument_Serif } from "next/font/google"
import { SITE_URL } from "@/lib/site"
import { JsonLd, OG_IMAGES, ORGANIZATION, SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/seo"
import { SiteFooter, SiteNav } from "@/components/site-chrome"
import "./globals.css"

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-instrument-serif",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    url: "/",
    images: OG_IMAGES,
  },
  twitter: { card: "summary_large_image" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
  --font-instrument-serif: ${instrumentSerif.variable};
}
        `}</style>
      </head>
      <body className={`flex min-h-screen flex-col ${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}>
        <JsonLd
          data={{
            "@graph": [
              ORGANIZATION,
              {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                name: SITE_NAME,
                description: SITE_DESCRIPTION,
                url: absoluteUrl("/"),
                inLanguage: "en",
                publisher: { "@id": ORGANIZATION["@id"] },
              },
            ],
          }}
        />
        <SiteNav />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  )
}
