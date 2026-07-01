import { useOrganizerAuth } from '../auth/organizer/OrganizerAuthContext';
import { AccountMenu, LandingPageNavbar } from '../components/layout/navbars';
import { HeroSection } from './home/HeroSection';
import { JourneySection } from './home/JourneySection';
import { OperationsSection } from './home/OperationsSection';
import { PaymentSection } from './home/PaymentSection';
import { PricingSection } from './home/PricingSection';
import { ProblemSection } from './home/ProblemSection';

export default function Home() {
  const { isAuthenticated, status, logout } = useOrganizerAuth();

  return (
    <div className="landing-page min-h-screen overflow-x-clip bg-background">
      <LandingPageNavbar
        right={
          status === 'loading' ? null : (
            <AccountMenu isAuthenticated={isAuthenticated} onSignOut={logout} />
          )
        }
        widthClassName="w-[calc(100%_-_3rem)] max-w-[calc(80rem-3rem)]"
      />

      <main>
        <HeroSection status={status} />
        <ProblemSection />
        <PaymentSection />
        <JourneySection />
        <OperationsSection />
        <PricingSection status={status} />
      </main>
    </div>
  );
}
