export const metadata = {
  title: 'Bessani Soluções — Processo Seletivo',
  description: 'Plataforma de recrutamento Bessani Soluções',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0, background: '#F1F5F9' }}>
        {children}
      </body>
    </html>
  )
}
