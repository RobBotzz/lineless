import type { LiveOrder } from '@/api/eventControlCenter';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';
import { LiveOrdersSection } from './management/LiveOrdersSection';
import { OperationalPausingSection } from './management/OperationalPausingSection';
import { StockManagementSection } from './management/StockManagementSection';

export function EventControlCenterManagementPage({
  liveOrders,
  mutationError,
  onCancelOrder,
  onCancelOrderItems,
  onProductPauseChange,
  onProductStockChange,
  onStandPauseChange,
  productsByStand,
  stands,
}: {
  liveOrders: LiveOrder[];
  mutationError: string | null;
  onCancelOrder: (orderId: string) => Promise<void>;
  onCancelOrderItems: (orderId: string, itemIds: string[]) => Promise<void>;
  onProductPauseChange: (standId: string, product: Product, paused: boolean) => Promise<void>;
  onProductStockChange: (standId: string, product: Product, productStock: number) => Promise<void>;
  onStandPauseChange: (stand: Stand, paused: boolean) => Promise<void>;
  stands: Stand[];
  productsByStand: Record<string, Product[]>;
}) {
  return (
    <div className="space-y-6">
      {mutationError ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {mutationError}
        </p>
      ) : null}

      <LiveOrdersSection
        liveOrders={liveOrders}
        stands={stands}
        onCancelOrder={onCancelOrder}
        onCancelOrderItems={onCancelOrderItems}
      />

      <StockManagementSection
        productsByStand={productsByStand}
        stands={stands}
        onProductStockChange={onProductStockChange}
      />

      <OperationalPausingSection
        liveOrders={liveOrders}
        productsByStand={productsByStand}
        stands={stands}
        onCancelOrderItems={onCancelOrderItems}
        onProductPauseChange={onProductPauseChange}
        onStandPauseChange={onStandPauseChange}
      />
    </div>
  );
}
