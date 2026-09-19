"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LuDelete, LuLoaderCircle, LuLogOut, LuPrinter, LuScanBarcode, LuSearch, LuTrash2, LuUser } from "react-icons/lu";
import { formatVariantLabel } from "@/lib/utils";

type StaffMember = { id: string; nameEn: string; nameAr: string; avatar: string | null };

type PosLine = {
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  color: string | null;
  colorParts: { part: string; color: string }[] | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  unitPrice: number;
  stock: number | null;
  imageUrl: string | null;
};

type CartLine = PosLine & { quantity: number };

type Category = { id: string; nameEn: string };
type ColorFacet = { value: string; hex: string | null };

type Screen = "picker" | "pin" | "terminal" | "receipt";

type StoreInfo = { store_name_en?: string; store_address?: string; store_phone?: string };

type ReceiptData = {
  orderNumber: string;
  items: { name: string; variant: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashierName: string;
  createdAt: string;
};

const lineKey = (l: { variantId: string | null; productId: string }) => l.variantId || l.productId;
const omr = (n: number) => `${n.toFixed(3)} OMR`;

export default function PosPage() {
  const [screen, setScreen] = useState<Screen>("picker");
  const [checkingSession, setCheckingSession] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [cashierName, setCashierName] = useState("");
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({});

  const [cart, setCart] = useState<CartLine[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [colorFacets, setColorFacets] = useState<ColorFacet[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [catalog, setCatalog] = useState<PosLine[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);

  const loadStaff = useCallback(() => {
    setLoadingStaff(true);
    fetch("/api/pos/staff", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setStaff(d.data); })
      .finally(() => setLoadingStaff(false));
  }, []);

  // Pick up an already-active session (e.g. the page was refreshed mid-shift)
  // instead of always forcing the staff picker.
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.permissions?.includes("pos.access")) {
          setCashierName(d.data.nameEn || d.data.email);
          setScreen("terminal");
        } else {
          loadStaff();
        }
      })
      .catch(() => loadStaff())
      .finally(() => setCheckingSession(false));
  }, [loadStaff]);

  useEffect(() => {
    fetch("/api/settings?group=general")
      .then((r) => r.json())
      .then((d) => { if (d.success) setStoreInfo(d.data); })
      .catch(() => {});
  }, []);

  // Category + color options for the browse filters (colors come from the
  // public storefront products facet — no dedicated endpoint needed).
  useEffect(() => {
    fetch("/api/categories?all=true")
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategories(d.data); })
      .catch(() => {});
    fetch("/api/products?pageSize=1")
      .then((r) => r.json())
      .then((d) => { if (d.success) setColorFacets(d.meta?.colors || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (screen === "terminal") scanInputRef.current?.focus();
  }, [screen, cart.length]);

  // Live-filtered catalog grid — updates as the cashier types, or picks a
  // category/color, so items can be found by browsing, not only by scanning.
  useEffect(() => {
    if (screen !== "terminal") return;
    setCatalogLoading(true);
    const params = new URLSearchParams();
    if (scanValue.trim()) params.set("q", scanValue.trim());
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (colorFilter) params.set("color", colorFilter);
    const t = setTimeout(() => {
      fetch(`/api/pos/lookup?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => { if (d.success) setCatalog(d.data); })
        .catch(() => {})
        .finally(() => setCatalogLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [screen, scanValue, categoryFilter, colorFilter]);

  const pickStaff = (member: StaffMember) => {
    setSelectedStaff(member);
    setPin("");
    setPinError("");
    setScreen("pin");
  };

  const submitPin = useCallback(
    async (value: string) => {
      if (!selectedStaff) return;
      setPinSubmitting(true);
      setPinError("");
      try {
        const res = await fetch("/api/pos/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedStaff.id, pin: value }),
        });
        const data = await res.json();
        if (!data.success) {
          setPinError(data.error || "Incorrect PIN.");
          setPin("");
          return;
        }
        setCashierName(selectedStaff.nameEn || selectedStaff.nameAr);
        setScreen("terminal");
      } catch {
        setPinError("Something went wrong. Try again.");
        setPin("");
      } finally {
        setPinSubmitting(false);
      }
    },
    [selectedStaff]
  );

  const pressDigit = (d: string) => {
    if (pinSubmitting || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) submitPin(next);
  };

  const switchUser = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setCart([]);
    setSelectedStaff(null);
    setScreen("picker");
    loadStaff();
  };

  const addLine = useCallback((line: PosLine) => {
    setCart((prev) => {
      const key = lineKey(line);
      const existing = prev.find((l) => lineKey(l) === key);
      if (existing) {
        return prev.map((l) => (lineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { ...line, quantity: 1 }];
    });
    setScanValue("");
    setScanError("");
    scanInputRef.current?.focus();
  }, []);

  // Enter (typically a barcode scanner sending its trailing Enter keystroke)
  // adds directly: an exact barcode match, or — if the live-filtered grid
  // below has narrowed to exactly one item — that item.
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = scanValue.trim();
    if (!value) return;
    setScanError("");
    try {
      const byBarcode = await fetch(`/api/pos/lookup?barcode=${encodeURIComponent(value)}`).then((r) => r.json());
      if (byBarcode.success && byBarcode.data.length >= 1) {
        addLine(byBarcode.data[0]);
        return;
      }
      if (catalog.length === 1) {
        addLine(catalog[0]);
        return;
      }
      if (catalog.length === 0) setScanError(`No product found for "${value}"`);
    } catch {
      setScanError("Lookup failed. Try again.");
    }
  };

  const updateQty = (key: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0 ? prev.filter((l) => lineKey(l) !== key) : prev.map((l) => (lineKey(l) === key ? { ...l, quantity } : l))
    );
  };

  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discountNum = Math.min(Math.max(parseFloat(discount) || 0, 0), subtotal);
  const total = subtotal - discountNum;

  const completeSale = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, quantity: l.quantity })),
          paymentMethod,
          discount: discountNum,
          customerPhone: customerPhone || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setCheckoutError(data.error || "Could not complete the sale.");
        return;
      }
      setReceipt({
        orderNumber: data.data.orderNumber,
        items: cart.map((l) => ({
          name: l.nameEn,
          variant: formatVariantLabel(l),
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.unitPrice * l.quantity,
        })),
        subtotal,
        discount: discountNum,
        total,
        paymentMethod,
        cashierName,
        createdAt: new Date().toISOString(),
      });
      setScreen("receipt");
      setCart([]);
      setDiscount("0");
      setCustomerPhone("");
    } catch {
      setCheckoutError("Something went wrong. Try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LuLoaderCircle size={28} className="animate-spin text-rose-400" />
      </div>
    );
  }

  // ---------- Staff picker ----------
  if (screen === "picker") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <LuScanBarcode size={40} className="text-rose-400 mb-3" />
        <h1 className="text-2xl font-semibold text-slate-800 mb-1">Hala Dresses POS</h1>
        <p className="text-slate-500 mb-8">Tap your name to sign in</p>
        {loadingStaff ? (
          <LuLoaderCircle size={24} className="animate-spin text-slate-400" />
        ) : staff.length === 0 ? (
          <p className="text-slate-400 text-center max-w-sm">
            No staff are set up for POS yet. An admin needs to grant &quot;Use POS&quot; access to a role and set a PIN
            under Users.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-3xl w-full">
            {staff.map((s) => (
              <button
                key={s.id}
                onClick={() => pickStaff(s)}
                className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-rose-300 hover:shadow-md transition-all"
              >
                <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center overflow-hidden">
                  {s.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatar} alt={s.nameEn} className="w-full h-full object-cover" />
                  ) : (
                    <LuUser size={26} />
                  )}
                </div>
                <span className="font-medium text-slate-700 text-center">{s.nameEn || s.nameAr}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- PIN pad ----------
  if (screen === "pin" && selectedStaff) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
          <LuUser size={26} />
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-1">{selectedStaff.nameEn || selectedStaff.nameAr}</h2>
        <p className="text-slate-500 mb-6">Enter your 4-digit PIN</p>

        <div className="flex gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className={`w-4 h-4 rounded-full border-2 ${i < pin.length ? "bg-rose-500 border-rose-500" : "border-slate-300"}`}
            />
          ))}
        </div>

        {pinError && <p className="text-rose-600 text-sm mb-3">{pinError}</p>}
        {pinSubmitting && <LuLoaderCircle size={18} className="animate-spin text-slate-400 mb-3" />}

        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              disabled={pinSubmitting}
              className="h-16 rounded-2xl bg-white border border-slate-200 text-xl font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => { setSelectedStaff(null); setScreen("picker"); }}
            className="h-16 rounded-2xl text-sm font-medium text-slate-500 hover:bg-slate-50"
          >
            Back
          </button>
          <button
            onClick={() => pressDigit("0")}
            disabled={pinSubmitting}
            className="h-16 rounded-2xl bg-white border border-slate-200 text-xl font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={() => setPin((p) => p.slice(0, -1))}
            disabled={pinSubmitting}
            className="h-16 rounded-2xl text-slate-500 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40"
            aria-label="Backspace"
          >
            <LuDelete size={22} />
          </button>
        </div>
      </div>
    );
  }

  // ---------- Receipt ----------
  if (screen === "receipt" && receipt) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6 font-mono text-sm">
          <div className="text-center mb-4">
            <p className="font-semibold text-base">{storeInfo.store_name_en || "Hala Dresses"}</p>
            {storeInfo.store_address && <p className="text-slate-500 text-xs">{storeInfo.store_address}</p>}
            {storeInfo.store_phone && <p className="text-slate-500 text-xs">{storeInfo.store_phone}</p>}
          </div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <p>Order: {receipt.orderNumber}</p>
          <p>Date: {new Date(receipt.createdAt).toLocaleString()}</p>
          <p>Cashier: {receipt.cashierName}</p>
          <div className="border-t border-dashed border-slate-300 my-3" />
          {receipt.items.map((it, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between">
                <span>{it.name}</span>
                <span>{omr(it.total)}</span>
              </div>
              <div className="text-xs text-slate-500">
                {[it.variant, `${it.quantity} × ${omr(it.unitPrice)}`].filter(Boolean).join(" · ")}
              </div>
            </div>
          ))}
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between"><span>Subtotal</span><span>{omr(receipt.subtotal)}</span></div>
          {receipt.discount > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>-{omr(receipt.discount)}</span></div>
          )}
          <div className="flex justify-between font-semibold text-base mt-1"><span>Total</span><span>{omr(receipt.total)}</span></div>
          <div className="flex justify-between text-slate-500 mt-1"><span>Paid via</span><span>{receipt.paymentMethod}</span></div>
        </div>

        <div className="flex gap-3 mt-6 print:hidden">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 text-white px-5 py-2.5 font-medium hover:bg-slate-900">
            <LuPrinter size={16} /> Print
          </button>
          <button onClick={() => { setReceipt(null); setScreen("terminal"); }} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 text-white px-5 py-2.5 font-medium hover:bg-rose-600">
            New Sale
          </button>
        </div>
      </div>
    );
  }

  // ---------- Terminal ----------
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between bg-white border-b border-slate-200 px-4 sm:px-6 py-3 print:hidden">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <LuScanBarcode size={20} className="text-rose-500" /> Hala Dresses POS
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden sm:inline">{cashierName}</span>
          <button onClick={switchUser} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-rose-600">
            <LuLogOut size={16} /> Switch User
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 sm:p-6 print:hidden">
        {/* Scan + browse + cart */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <form onSubmit={handleScanSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <LuScanBarcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={scanInputRef}
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                placeholder="Scan a barcode, or type a name / SKU / code to browse"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-rose-300"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="px-4 rounded-xl bg-slate-800 text-white hover:bg-slate-900">
              <LuSearch size={18} />
            </button>
          </form>
          {scanError && <p className="text-rose-600 text-sm">{scanError}</p>}

          {/* Category / color filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600"
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
            </select>
            {colorFacets.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setColorFilter("")}
                  className={`text-xs px-2.5 py-1.5 rounded-full border ${colorFilter === "" ? "border-rose-400 bg-rose-50 text-rose-600" : "border-slate-200 text-slate-500"}`}
                >
                  All colors
                </button>
                {colorFacets.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setColorFilter(c.value === colorFilter ? "" : c.value)}
                    title={c.value}
                    aria-label={c.value}
                    className={`w-7 h-7 rounded-full border-2 flex-shrink-0 ${colorFilter === c.value ? "border-rose-500" : "border-transparent"}`}
                  >
                    <span className="block w-full h-full rounded-full border border-slate-200" style={{ background: c.hex || "#ccc" }} />
                  </button>
                ))}
              </div>
            )}
            {catalogLoading && <LuLoaderCircle size={14} className="animate-spin text-slate-400" />}
          </div>

          {/* Catalog grid — tap to add */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 p-2.5 overflow-y-auto">
            {catalog.length === 0 ? (
              <p className="text-center text-slate-400 py-6 text-sm">
                {catalogLoading ? "Searching…" : "No matching products"}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-2">
                {catalog.map((r) => {
                  const outOfStock = r.stock !== null && r.stock <= 0;
                  return (
                    <button
                      key={`${r.productId}-${r.variantId ?? "base"}`}
                      onClick={() => !outOfStock && addLine(r)}
                      disabled={outOfStock}
                      className="text-left rounded-lg border border-slate-200 overflow-hidden bg-white hover:border-rose-300 hover:shadow-sm transition-all disabled:opacity-40 disabled:hover:border-slate-200"
                    >
                      <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imageUrl} alt={r.nameEn} className="w-full h-full object-cover" />
                        ) : (
                          <LuScanBarcode size={16} className="text-slate-300" />
                        )}
                      </div>
                      <div className="px-1.5 py-1.5">
                        <p className="text-[11px] font-medium text-slate-800 truncate leading-tight">{r.nameEn}</p>
                        {formatVariantLabel(r) && (
                          <p className="text-[10px] text-slate-400 truncate leading-tight">{formatVariantLabel(r)}</p>
                        )}
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[11px] font-semibold text-slate-700">{omr(r.unitPrice)}</span>
                          {outOfStock && <span className="text-[9px] text-rose-500 font-medium">Sold out</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart + checkout sidebar */}
        <div className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-3 min-h-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-[180px] max-h-[42vh] lg:max-h-none">
            <div className="px-3.5 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase flex-shrink-0">
              Cart ({cart.length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {cart.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm px-3">Scan or tap an item to add it</p>
              ) : (
                cart.map((l) => {
                  const key = lineKey(l);
                  return (
                    <div key={key} className="flex items-center gap-2 px-3.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{l.nameEn}</p>
                        {formatVariantLabel(l) && <p className="text-xs text-slate-400 truncate">{formatVariantLabel(l)}</p>}
                      </div>
                      <div className="flex items-center rounded-md border border-slate-200 flex-shrink-0">
                        <button onClick={() => updateQty(key, l.quantity - 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-rose-600 text-sm">−</button>
                        <span className="w-6 text-center text-xs">{l.quantity}</span>
                        <button onClick={() => updateQty(key, l.quantity + 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-rose-600 text-sm">+</button>
                      </div>
                      <span className="w-16 text-right text-xs font-medium text-slate-700 flex-shrink-0">{omr(l.unitPrice * l.quantity)}</span>
                      <button onClick={() => updateQty(key, 0)} className="text-slate-300 hover:text-rose-500 flex-shrink-0" aria-label="Remove">
                        <LuTrash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Checkout panel */}
          <div className="flex-shrink-0 bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{omr(subtotal)}</span></div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Discount</span>
                <input
                  type="number" min="0" step="0.001"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 text-right border border-slate-200 rounded-lg px-2 py-1"
                />
              </div>
              <div className="flex justify-between font-semibold text-slate-800 text-base pt-1 border-t border-slate-100"><span>Total</span><span>{omr(total)}</span></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Customer phone (optional)</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="For loyalty / order history"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2">
              {(["CASH", "CARD"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border ${
                    paymentMethod === m ? "bg-rose-500 border-rose-500 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {m === "CASH" ? "Cash" : "Card"}
                </button>
              ))}
            </div>

            {checkoutError && <p className="text-rose-600 text-sm">{checkoutError}</p>}

            <button
              onClick={completeSale}
              disabled={cart.length === 0 || checkingOut}
              className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {checkingOut ? <LuLoaderCircle size={18} className="animate-spin" /> : `Complete Sale — ${omr(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
