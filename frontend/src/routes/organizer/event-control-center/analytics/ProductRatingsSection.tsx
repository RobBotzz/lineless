import { useMemo, useState } from 'react';

import type { ProductRating } from '@/api/eventControlCenter';
import { ImageIcon } from '@/components/icons';
import { Rating } from '@/features/catalog/Rating';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product } from '@/types/product';
import type { Stand } from '@/types/stand';
import { ChipFilter } from '../components/ChipFilter';

type StandDisplay = Pick<Stand, '_id' | 'standName'>;

export function ProductRatingsSection({
  productRatings,
  productsByStand,
  stands,
}: {
  productRatings: ProductRating[];
  productsByStand: Record<string, Product[]>;
  stands: Stand[];
}) {
  const [selectedStandId, setSelectedStandId] = useState('all');
  const [selectedProductId, setSelectedProductId] = useState('all');
  const boothSelected = selectedStandId !== 'all';
  const productsForSelectedStand = useMemo(
    () =>
      boothSelected
        ? [...(productsByStand[selectedStandId] ?? [])].sort((left, right) =>
            left.productName.localeCompare(right.productName),
          )
        : [],
    [boothSelected, productsByStand, selectedStandId],
  );
  const ratingStands = useMemo(
    () => stands.filter((stand) => stand.standType === 'PRODUCT'),
    [stands],
  );
  const filteredRatings = useMemo(
    () =>
      productRatings.filter((rating) => {
        if (selectedStandId !== 'all' && rating.standId !== selectedStandId) return false;
        if (selectedProductId !== 'all' && rating.productId !== selectedProductId) return false;
        return true;
      }),
    [productRatings, selectedProductId, selectedStandId],
  );
  const positiveRatings = filteredRatings.filter((rating) => rating.stars >= 4);
  const actionRatings = filteredRatings.filter((rating) => rating.stars <= 3);

  function handleSelectStand(standId: string) {
    setSelectedStandId(standId);
    setSelectedProductId('all');
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Product Ratings</CardTitle>
            <p className="mt-2 text-sm text-text-muted">
              Latest product reviews split by sentiment.
            </p>
          </div>
          <ProductRatingsFilters
            boothSelected={boothSelected}
            products={productsForSelectedStand}
            selectedProductId={selectedProductId}
            selectedStandId={selectedStandId}
            stands={ratingStands}
            onSelectProduct={setSelectedProductId}
            onSelectStand={handleSelectStand}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <ProductRatingFeed
            emptyMessage="Positive reviews will appear here as guests rate products."
            ratings={positiveRatings}
            title="Positive Vibes"
            tone="positive"
          />
          <ProductRatingFeed
            emptyMessage="Lower-rated reviews will appear here for quick follow-up."
            ratings={actionRatings}
            title="Action Required"
            tone="action"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ProductRatingsFilters({
  boothSelected,
  onSelectProduct,
  onSelectStand,
  products,
  selectedProductId,
  selectedStandId,
  stands,
}: {
  boothSelected: boolean;
  onSelectProduct: (productId: string) => void;
  onSelectStand: (standId: string) => void;
  products: Product[];
  selectedProductId: string;
  selectedStandId: string;
  stands: StandDisplay[];
}) {
  const selectedStand = stands.find((stand) => stand._id === selectedStandId) ?? null;

  return (
    <div className="w-full space-y-3 lg:max-w-xl lg:justify-self-end">
      <ChipFilter
        ariaLabel="Product ratings booth filter"
        label="Stands"
        options={stands.map((stand) => ({ label: stand.standName, value: stand._id }))}
        resetValue={selectedStand ? 'all' : undefined}
        selectedValue={selectedStandId}
        onSelect={onSelectStand}
      />
      <div
        className={[
          'grid w-full transition-all duration-300 ease-out lg:justify-items-end',
          boothSelected
            ? 'grid-rows-[1fr] translate-y-0 opacity-100'
            : 'grid-rows-[0fr] -translate-y-2 opacity-0',
        ].join(' ')}
      >
        <div className="min-h-0 overflow-hidden">
          <ChipFilter
            ariaLabel="Product ratings product filter"
            label="Products"
            options={products.map((product) => ({
              label: product.productName,
              value: product._id,
            }))}
            resetValue={selectedProductId !== 'all' ? 'all' : undefined}
            selectedValue={selectedProductId}
            onSelect={onSelectProduct}
          />
        </div>
      </div>
    </div>
  );
}

function ProductRatingFeed({
  emptyMessage,
  ratings,
  title,
  tone,
}: {
  emptyMessage: string;
  ratings: ProductRating[];
  title: string;
  tone: 'action' | 'positive';
}) {
  const toneClasses =
    tone === 'positive'
      ? {
          badge: 'border-success/30 bg-success/10 text-success',
          rail: 'bg-success',
        }
      : {
          badge: 'border-danger/30 bg-danger/10 text-danger',
          rail: 'bg-danger',
        };

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={['h-8 w-1 rounded-full', toneClasses.rail].join(' ')} />
          <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
        </div>
        <span
          className={[
            'rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums',
            toneClasses.badge,
          ].join(' ')}
        >
          {ratings.length}
        </span>
      </div>
      <div className="max-h-[34rem] space-y-3 overflow-y-auto p-3">
        {ratings.length > 0 ? (
          ratings.map((rating) => <ProductRatingCard key={rating._id} rating={rating} />)
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-text-muted">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}

function ProductRatingCard({ rating }: { rating: ProductRating }) {
  const [imageOk, setImageOk] = useState(true);
  const showImage = !!rating.productImageUrl && imageOk;

  return (
    <article className="min-w-0 rounded-lg border border-border bg-surface p-3 shadow-sm">
      <div className="flex gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted">
          {showImage ? (
            <img
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageOk(false)}
              src={rating.productImageUrl!}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-text-muted">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-text [overflow-wrap:anywhere]">
                {rating.productName}
              </h4>
              <span className="mt-1 inline-flex min-w-0 max-w-full rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-text-muted">
                <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
                  {rating.standName}
                </span>
              </span>
            </div>
            <Rating value={rating.stars} className="shrink-0" />
          </div>
          {rating.comment ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text [overflow-wrap:anywhere]">
              {rating.comment}
            </p>
          ) : (
            <p className="mt-3 text-sm italic leading-6 text-text-muted">No message provided.</p>
          )}
        </div>
      </div>
    </article>
  );
}
