"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { getListing, getBranch, getAvailabilityLocks, getSettings } from "@/lib/firebase-db"
import type { Listing, Branch, AvailabilityLock, ListingSlot, SelectedAddon, SiteSettings } from "@/lib/types"
import { LISTING_TYPE_LABELS } from "@/lib/constants"
import { DEFAULT_SETTINGS } from "@/lib/constants"
import { useAuth } from "@/lib/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { WhatsAppFloat } from "@/components/home/whatsapp-float"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  MapPin,
  Users,
  Clock,
  Shield,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Car,
  Zap,
  Volume2,
  Check,
} from "lucide-react"
import { format, addDays, isBefore, startOfDay } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"

export default function ListingDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { user } = useAuth()

  const [listing, setListing] = useState<Listing | null>(null)
  const [branch, setBranch] = useState<Branch | null>(null)
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS)
  const [locks, setLocks] = useState<AvailabilityLock[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    addDays(new Date(), 1)
  )
  const [selectedSlot, setSelectedSlot] = useState<ListingSlot | null>(null)
  const [guestCount, setGuestCount] = useState(1)
  const [unitsBooked, setUnitsBooked] = useState(1)
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({})
  const [currentImage, setCurrentImage] = useState(0)
  const [currentImageFailed, setCurrentImageFailed] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [listingData, settingsData] = await Promise.all([
          getListing(id),
          getSettings(),
        ])
        if (!listingData) {
          toast.error("Listing not found")
          router.push("/explore")
          return
        }
        setListing(listingData)
        setSettings(settingsData)

        if (listingData.branchId) {
          const branchData = await getBranch(listingData.branchId)
          setBranch(branchData)
        }
      } catch {
        toast.error("Failed to load listing")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  const loadAvailability = useCallback(async () => {
    if (!listing || !selectedDate) return
    const dateStr = format(selectedDate, "yyyy-MM-dd")
    try {
      const lockData = await getAvailabilityLocks(listing.id, [dateStr])
      setLocks(lockData)
    } catch {
      // Handle silently
    }
  }, [listing, selectedDate])

  useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  function getAvailableUnits(slotId: string): number {
    if (!listing || !selectedDate) return 0
    const dateStr = format(selectedDate, "yyyy-MM-dd")
    const lock = locks.find(
      (l) => l.date === dateStr && l.slotId === slotId
    )
    if (lock?.isBlocked) return 0
    const booked = lock?.bookedUnits || 0
    return Math.max(0, (listing.inventory || 1) - booked)
  }

  function calculatePrice(): {
    base: number
    addonsTotal: number
    serviceFee: number
    tax: number
    total: number
  } {
    if (!listing) return { base: 0, addonsTotal: 0, serviceFee: 0, tax: 0, total: 0 }

    let base = listing.pricePerUnit * unitsBooked
    if (listing.slotsEnabled && selectedSlot) {
      base = selectedSlot.price * unitsBooked
    }

    let addonsTotal = 0
    listing.addons?.forEach((addon) => {
      if (selectedAddons[addon.name]) {
        if (addon.type === "per_person") {
          addonsTotal += addon.price * guestCount
        } else {
          addonsTotal += addon.price
        }
      }
    })

    const subtotal = base + addonsTotal
    const serviceFee = Math.round(subtotal * (settings.serviceFeePercent / 100))
    const tax = Math.round((subtotal + serviceFee) * (settings.taxPercent / 100))
    const total = subtotal + serviceFee + tax

    return { base, addonsTotal, serviceFee, tax, total }
  }

  function handleBook() {
    if (!user) {
      toast.error("Please sign in to book")
      router.push("/login")
      return
    }
    if (!selectedDate) {
      toast.error("Please select a date")
      return
    }
    if (listing?.slotsEnabled && !selectedSlot) {
      toast.error("Please select a time slot")
      return
    }

    const slotId = selectedSlot?.slotId || "fullday"
    const available = getAvailableUnits(slotId)
    if (available < unitsBooked) {
      toast.error(`Only ${available} unit(s) available`)
      return
    }

    const price = calculatePrice()
    const addonsArr: SelectedAddon[] = []
    listing?.addons?.forEach((addon) => {
      if (selectedAddons[addon.name]) {
        const qty = addon.type === "per_person" ? guestCount : 1
        addonsArr.push({
          name: addon.name,
          quantity: qty,
          totalPrice: addon.price * qty,
        })
      }
    })

    const checkoutData = {
      listingId: listing!.id,
      branchId: listing!.branchId,
      checkInDate: format(selectedDate, "yyyy-MM-dd"),
      slotId: selectedSlot?.slotId || null,
      slotName: selectedSlot?.name || null,
      guestCount,
      unitsBooked,
      selectedAddons: addonsArr,
      basePrice: price.base,
      addonsTotal: price.addonsTotal,
      serviceFee: price.serviceFee,
      taxAmount: price.tax,
      totalAmount: price.total,
    }

    sessionStorage.setItem("checkoutData", JSON.stringify(checkoutData))
    router.push("/checkout")
  }

  const price = calculatePrice()
  const hasOffer =
    typeof listing?.originalPrice === "number" &&
    listing.originalPrice > listing.pricePerUnit
  const discountPercent = hasOffer
    ? Math.round(
        ((listing!.originalPrice! - listing!.pricePerUnit) / listing!.originalPrice!) *
          100
      )
    : 0
  const images = useMemo(() => {
    return (listing?.images || [])
      .map((image) => image?.trim())
      .filter(
        (image): image is string =>
          Boolean(image) &&
          (image.startsWith("https://") || image.startsWith("http://"))
      )
  }, [listing?.images])
  const today = startOfDay(new Date())
  const maxDate = addDays(today, settings.maxBookingWindowDays)

  useEffect(() => {
    if (currentImage >= images.length) {
      setCurrentImage(0)
    }
  }, [currentImage, images.length])

  useEffect(() => {
    setCurrentImageFailed(false)
  }, [currentImage, id])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    )
  }

  if (!listing) return null

  const whatsappMessage = `Hi Anga Function Hall, I am interested in booking ${listing.title}. Please share details.`

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/explore" className="hover:text-primary">
              Explore
            </Link>
            <span>/</span>
            <span className="text-foreground">{listing.title}</span>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Info */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              {/* Image Gallery */}
              <div className="relative overflow-hidden rounded-xl">
                <div className="aspect-[16/9] bg-muted">
                  {images.length > 0 && !currentImageFailed ? (
                    <img
                      src={images[currentImage]}
                      alt={`${listing.title} - Image ${currentImage + 1}`}
                      className="h-full w-full object-cover"
                      onError={() => setCurrentImageFailed(true)}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-sm text-muted-foreground">
                        No image available
                      </span>
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setCurrentImage(
                          currentImage === 0
                            ? images.length - 1
                            : currentImage - 1
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() =>
                        setCurrentImage(
                          currentImage === images.length - 1
                            ? 0
                            : currentImage + 1
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImage(i)}
                          className={`h-2 w-2 rounded-full transition-colors ${
                            i === currentImage
                              ? "bg-primary-foreground"
                              : "bg-primary-foreground/40"
                          }`}
                          aria-label={`Go to image ${i + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Title & Badge */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {LISTING_TYPE_LABELS[listing.type]}
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
                  {listing.title}
                </h1>
                {branch && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {branch.name}, {branch.city}, {branch.state}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  Up to {listing.capacity} guests
                </div>
                {listing.inventory > 1 && (
                  <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                    <span className="font-medium">{listing.inventory}</span>
                    units available
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                  <Shield className="h-4 w-4 text-primary" />
                  {listing.cancellationPolicy === "free"
                    ? "Free Cancellation"
                    : listing.cancellationPolicy === "partial"
                      ? "Partial Refund"
                      : "Non-refundable"}
                </div>
              </div>

              {/* Description */}
              {listing.description && (
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    About this venue
                  </h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {listing.description}
                  </p>
                </div>
              )}

              {/* Amenities */}
              {listing.amenities && listing.amenities.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    Amenities
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {listing.amenities.map((amenity) => (
                      <div
                        key={amenity}
                        className="flex items-center gap-2 text-sm text-foreground"
                      >
                        <Check className="h-4 w-4 text-primary" />
                        {amenity}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rules */}
              {listing.rules && listing.rules.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-lg font-semibold text-foreground">
                    Rules & Policies
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {listing.rules.map((rule, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right Column - Booking Card */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <Card className="shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      {hasOffer && (
                        <p className="text-sm text-muted-foreground line-through">
                          {`\u20B9${listing.originalPrice!.toLocaleString("en-IN")}`}
                        </p>
                      )}
                      <CardTitle className="text-xl">
                        {`\u20B9${listing.pricePerUnit.toLocaleString("en-IN")}`}
                      </CardTitle>
                      {hasOffer && (
                        <p className="text-xs font-medium text-emerald-600">
                          {discountPercent}% OFF
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      per {listing.type === "room" || listing.type === "dormitory" ? "night" : "booking"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {/* Date Picker */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Select Date</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) =>
                        isBefore(date, today) || isBefore(maxDate, date)
                      }
                      className="rounded-md border"
                    />
                  </div>

                  {/* Time Slots */}
                  {listing.slotsEnabled &&
                    listing.slots &&
                    listing.slots.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <Label className="text-sm font-medium">
                          Select Time Slot
                        </Label>
                        <div className="flex flex-col gap-2">
                          {listing.slots.map((slot) => {
                            const available = getAvailableUnits(slot.slotId)
                            const isSelected =
                              selectedSlot?.slotId === slot.slotId
                            return (
                              <button
                                key={slot.slotId}
                                type="button"
                                onClick={() =>
                                  available > 0 && setSelectedSlot(slot)
                                }
                                disabled={available <= 0}
                                className={`flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors ${
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : available > 0
                                      ? "hover:border-primary/50"
                                      : "cursor-not-allowed opacity-50"
                                }`}
                              >
                                <div>
                                  <p className="font-medium text-foreground">
                                    {slot.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    <Clock className="mr-1 inline h-3 w-3" />
                                    {slot.startTime} - {slot.endTime}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-foreground">
                                    {`\u20B9${slot.price.toLocaleString("en-IN")}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {available > 0
                                      ? `${available} available`
                                      : "Sold out"}
                                  </p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                  {/* Guest Count & Units */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm">Guests</Label>
                      <Input
                        type="number"
                        min={1}
                        max={listing.capacity}
                        value={guestCount}
                        onChange={(e) =>
                          setGuestCount(parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                    {listing.inventory > 1 && (
                      <div className="flex flex-col gap-2">
                        <Label className="text-sm">Units</Label>
                        <Input
                          type="number"
                          min={1}
                          max={listing.inventory}
                          value={unitsBooked}
                          onChange={(e) =>
                            setUnitsBooked(parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Add-ons */}
                  {listing.addons && listing.addons.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium">Add-ons</Label>
                      {listing.addons.map((addon) => (
                        <label
                          key={addon.name}
                          className="flex items-center justify-between rounded-lg border p-3 text-sm cursor-pointer hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={!!selectedAddons[addon.name]}
                              onCheckedChange={(c) =>
                                setSelectedAddons({
                                  ...selectedAddons,
                                  [addon.name]: !!c,
                                })
                              }
                            />
                            <span className="text-foreground">{addon.name}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {`\u20B9${addon.price}`}
                            {addon.type === "per_person" ? "/person" : addon.type === "per_hour" ? "/hr" : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  <Separator />

                  {/* Price Breakdown */}
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base price</span>
                      <span className="text-foreground">{`\u20B9${price.base.toLocaleString("en-IN")}`}</span>
                    </div>
                    {price.addonsTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Add-ons</span>
                        <span className="text-foreground">{`\u20B9${price.addonsTotal.toLocaleString("en-IN")}`}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Service fee ({settings.serviceFeePercent}%)
                      </span>
                      <span className="text-foreground">{`\u20B9${price.serviceFee.toLocaleString("en-IN")}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Tax ({settings.taxPercent}%)
                      </span>
                      <span className="text-foreground">{`\u20B9${price.tax.toLocaleString("en-IN")}`}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span className="text-foreground">Total</span>
                      <span className="text-primary text-lg">{`\u20B9${price.total.toLocaleString("en-IN")}`}</span>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleBook}
                  >
                    Book Now
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <WhatsAppFloat message={whatsappMessage} />
      <Footer />
    </div>
  )
}
