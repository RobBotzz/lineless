import type { LiveOrder } from '@/api/eventControlCenter';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';
import { LiveOrdersSection } from './management/LiveOrdersSection';
import { OperationalPausingSection } from './management/OperationalPausingSection';
import { StockManagementSection } from './management/StockManagementSection';

export function EventControlCenterManagementPage({
  liveOrders,
  onCancelOrder,
  onCancelOrderItems,
  onProductPauseChange,
  onProductStockChange,
  onStandPauseChange,
  productsByStand,
  stands,
}: {
  liveOrders: LiveOrder[];
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
