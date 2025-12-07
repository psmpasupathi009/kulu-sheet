import { AppSidebar } from "@/components/home/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/home/page-header";
import Image from "next/image";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen relative">
        {/* Background Image - Responsive for all screen sizes */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 w-full h-full">
            <Image
              src="/sivan.png"
              alt="Shiva Background"
              fill
              className="object-cover opacity-10"
              priority
              quality={90}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 100vw"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </div>
        <AppSidebar />
        <main className="flex-1 flex flex-col relative z-10 min-h-screen bg-background/50 backdrop-blur-[0.5px]">
          <PageHeader />
          <div className="flex-1 p-4">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
