export default function SelecionarPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-vitti-surface flex flex-col items-center justify-center px-4">
      {children}
    </div>
  );
}
