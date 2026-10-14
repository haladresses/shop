"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuArrowDownToLine,
  LuCircleCheck,
  LuKeyRound,
  LuShieldCheck,
  LuUsers,
  LuLayoutDashboard,
  LuArrowUpFromLine,
  LuBanknote,
  LuClock,
  LuCreditCard,
  LuDelete,
  LuHistory,
  LuLoaderCircle,
  LuLock,
  LuLogOut,
  LuMaximize,
  LuMinus,
  LuPackageOpen,
  LuPause,
  LuPlay,
  LuPlus,
  LuPrinter,
  LuReceipt,
  LuRotateCcw,
  LuScanBarcode,
  LuSearch,
  LuShoppingBag,
  LuSplit,
  LuTrash2,
  LuUser,
  LuUserCheck,
  LuWallet,
  LuX,
} from "react-icons/lu";
import { formatVariantLabel } from "@/lib/utils";
import { PosModal, Receipt, ReceiptData, StoreInfo, beep, methodLabel, omr } from "@/components/pos/PosUi";
import ReturnModal from "@/components/pos/ReturnModal";

// ───────────────────────── types ─────────────────────────

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
type Screen = "picker" | "pin" | "openShift" | "terminal" | "receipt" | "zreport";
type PayMode = "CASH" | "CARD" | "SPLIT";

type Customer = { id: string; nameEn: string | null; nameAr: string | null; phone: string; orders: number; totalSpent: number };

type HeldCart = {
  id: string;
  label: string;
  cart: CartLine[];
  discountMode: "amount" | "percent";
  discountValue: string;
  customerPhone: string;
  customerName: string;
  at: string;
};

type ShiftSummary = {
  id: string;
  status: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  salesCount: number;
  salesTotal: number;
  discounts: number;
  byMethod: Record<string, number>;
  refunds: number;
  cashRefunds: number;
  payIns: number;
  payOuts: number;
  movements: { type: "IN" | "OUT"; amount: number; reason: string; at: string }[];
  expectedCash: number;
  difference: number | null;
};

type SaleItem = {
  id: string;
  productId: string;
  variantId: string | null;
  nameEn: string;
  nameAr: string;
  color: string | null;
  size: string | null;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
  total: number;
};

type Sale = {
  id: string;
  orderNumber: string;
  source: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  customerName: string;
  cashierName: string;
  subtotal: number;
  discount: number;
  total: number;
  refundedAmount: number;
  amountTendered: number | null;
  changeGiven: number | null;
  payments: { method: string; amount: number }[];
  items: SaleItem[];
};

const HELD_KEY = "hala-pos-held-carts";
const lineKey = (l: { variantId: string | null; productId: string }) => l.variantId || l.productId;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function readHeld(): HeldCart[] {
  try {
    const raw = window.localStorage.getItem(HELD_KEY);
    return raw ? (JSON.parse(raw) as HeldCart[]) : [];
  } catch {
    return [];
  }
}
function writeHeld(list: HeldCart[]) {
  try {
    window.localStorage.setItem(HELD_KEY, JSON.stringify(list));
  } catch {
    /* storage may be unavailable */
  }
}

async function postJson<T = unknown>(url: string, body: unknown): Promise<{ success: boolean; data?: T; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

// ───────────────────────── page ─────────────────────────

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
  // Staff who can also open the admin panel get a "Back to admin" button.
  const [canOpenAdmin, setCanOpenAdmin] = useState(false);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({});

  // shift
  const [shift, setShift] = useState<ShiftSummary | null>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftError, setShiftError] = useState("");
  const [zReport, setZReport] = useState<ShiftSummary | null>(null);

  // sale
  const [cart, setCart] = useState<CartLine[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // catalog
  const [categories, setCategories] = useState<Category[]>([]);
  const [colorFacets, setColorFacets] = useState<ColorFacet[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [catalog, setCatalog] = useState<PosLine[]>([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // modals
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState<PayMode>("CASH");
  const [tendered, setTendered] = useState("");
  const [splitCash, setSplitCash] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [cartOpen, setCartOpen] = useState(false); // mobile drawer
  const [heldOpen, setHeldOpen] = useState(false);
  const [held, setHeld] = useState<HeldCart[]>([]);
  const [salesOpen, setSalesOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState<null | "IN" | "OUT">(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const catalogScrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── bootstrapping ──
  const loadStaff = useCallback(() => {
    setLoadingStaff(true);
    fetch("/api/pos/staff", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.success && setStaff(d.data))
      .finally(() => setLoadingStaff(false));
  }, []);

  const loadShift = useCallback(async () => {
    const d = await fetch("/api/pos/shift", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    const s: ShiftSummary | null = d?.success ? d.data : null;
    setShift(s);
    return s;
  }, []);

  const enterTerminal = useCallback(async () => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCanOpenAdmin(!!d.data?.permissions?.includes("panel.admin.access")))
      .catch(() => {});
    const s = await loadShift();
    setScreen(s ? "terminal" : "openShift");
  }, [loadShift]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(async (d) => {
        if (d.success && d.data?.permissions?.includes("pos.access")) {
          setCashierName(d.data.nameEn || d.data.email);
          await enterTerminal();
        } else loadStaff();
      })
      .catch(() => loadStaff())
      .finally(() => setCheckingSession(false));
  }, [loadStaff, enterTerminal]);

  useEffect(() => {
    fetch("/api/settings?group=general")
      .then((r) => r.json())
      .then((d) => d.success && setStoreInfo(d.data))
      .catch(() => {});
    fetch("/api/categories?all=true")
      .then((r) => r.json())
      .then((d) => d.success && setCategories(d.data))
      .catch(() => {});
    fetch("/api/products?pageSize=1")
      .then((r) => r.json())
      .then((d) => d.success && setColorFacets(d.meta?.colors || []))
      .catch(() => {});
    setHeld(readHeld());
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (screen === "terminal" && !payOpen) scanInputRef.current?.focus();
  }, [screen, cart.length, payOpen]);

  // ── catalog (paged, infinite scroll) ──
  const fetchCatalog = useCallback(
    async (page: number, signal?: AbortSignal) => {
      const params = new URLSearchParams({ page: String(page) });
      if (scanValue.trim()) params.set("q", scanValue.trim());
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (colorFilter) params.set("color", colorFilter);
      if (inStockOnly) params.set("inStock", "true");
      const d = await fetch(`/api/pos/lookup?${params}`, { signal }).then((r) => r.json());
      return d.success ? { lines: d.data as PosLine[], hasMore: !!d.meta?.hasMore } : { lines: [], hasMore: false };
    },
    [scanValue, categoryFilter, colorFilter, inStockOnly],
  );

  useEffect(() => {
    if (screen !== "terminal") return;
    const controller = new AbortController();
    setCatalogLoading(true);
    const t = setTimeout(() => {
      fetchCatalog(1, controller.signal)
        .then(({ lines, hasMore }) => {
          setCatalog(lines);
          setCatalogPage(1);
          setCatalogHasMore(hasMore);
          catalogScrollRef.current?.scrollTo({ top: 0 });
        })
        .catch(() => {})
        .finally(() => setCatalogLoading(false));
    }, 220);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [screen, fetchCatalog]);

  const loadMore = useCallback(() => {
    if (catalogLoading || !catalogHasMore) return;
    setCatalogLoading(true);
    const next = catalogPage + 1;
    fetchCatalog(next)
      .then(({ lines, hasMore }) => {
        setCatalog((prev) => [...prev, ...lines]);
        setCatalogPage(next);
        setCatalogHasMore(hasMore);
      })
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, [catalogLoading, catalogHasMore, catalogPage, fetchCatalog]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || screen !== "terminal") return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
      root: catalogScrollRef.current,
      rootMargin: "400px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, screen]);

  // ── customer lookup ──
  useEffect(() => {
    const phone = customerPhone.trim();
    if (phone.length < 6) {
      setCustomer(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/pos/customer?phone=${encodeURIComponent(phone)}`)
        .then((r) => r.json())
        .then((d) => setCustomer(d.success ? d.data : null))
        .catch(() => setCustomer(null));
    }, 350);
    return () => clearTimeout(t);
  }, [customerPhone]);

  // ── staff login ──
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
        const data = await postJson("/api/pos/login", { userId: selectedStaff.id, pin: value });
        if (!data.success) {
          setPinError(data.error || "Incorrect PIN.");
          setPin("");
          beep("error");
          return;
        }
        setCashierName(selectedStaff.nameEn || selectedStaff.nameAr);
        await enterTerminal();
      } catch {
        setPinError("Something went wrong. Try again.");
        setPin("");
      } finally {
        setPinSubmitting(false);
      }
    },
    [selectedStaff, enterTerminal],
  );

  const pressDigit = useCallback(
    (d: string) => {
      if (pinSubmitting || pin.length >= 4) return;
      const next = pin + d;
      setPin(next);
      if (next.length === 4) submitPin(next);
    },
    [pin, pinSubmitting, submitPin],
  );

  // physical keyboard on the PIN pad
  useEffect(() => {
    if (screen !== "pin") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) pressDigit(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") setScreen("picker");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, pressDigit]);

  const resetSale = () => {
    setCart([]);
    setDiscountValue("");
    setDiscountMode("amount");
    setCustomerPhone("");
    setCustomerName("");
    setCustomer(null);
    setTendered("");
    setSplitCash("");
    setCheckoutError("");
  };

  const switchUser = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    resetSale();
    setShift(null);
    setCanOpenAdmin(false);
    setSelectedStaff(null);
    setScreen("picker");
    loadStaff();
  };

  // ── shift ──
  const openShift = async () => {
    setShiftBusy(true);
    setShiftError("");
    const d = await postJson<ShiftSummary>("/api/pos/shift", { action: "open", openingCash: parseFloat(openingCash) || 0 }).catch(() => null);
    setShiftBusy(false);
    if (!d?.success) return setShiftError(d?.error || "Could not open the shift.");
    setShift(d.data!);
    setScreen("terminal");
  };

  // ── cart ──
  const addLine = useCallback((line: PosLine) => {
    let blocked = false;
    setCart((prev) => {
      const key = lineKey(line);
      const existing = prev.find((l) => lineKey(l) === key);
      const nextQty = (existing?.quantity ?? 0) + 1;
      if (line.stock !== null && nextQty > line.stock) {
        blocked = true;
        return prev;
      }
      if (existing) return prev.map((l) => (lineKey(l) === key ? { ...l, quantity: nextQty } : l));
      return [{ ...line, quantity: 1 }, ...prev];
    });
    if (blocked) {
      setScanError(`Only ${line.stock} in stock for ${line.nameEn}`);
      beep("error");
    } else {
      setScanError("");
      setLastAddedKey(lineKey(line));
      setTimeout(() => setLastAddedKey(null), 700);
      beep("ok");
    }
    setScanValue("");
    scanInputRef.current?.focus();
  }, []);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = scanValue.trim();
    if (!value) return;
    setScanError("");
    try {
      const byBarcode = await fetch(`/api/pos/lookup?barcode=${encodeURIComponent(value)}`).then((r) => r.json());
      if (byBarcode.success && byBarcode.data.length >= 1) return addLine(byBarcode.data[0]);
      if (catalog.length === 1) return addLine(catalog[0]);
      if (catalog.length === 0) {
        setScanError(`No product found for "${value}"`);
        beep("error");
      }
    } catch {
      setScanError("Lookup failed. Try again.");
    }
  };

  const updateQty = (key: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((l) => lineKey(l) !== key)
        : prev.map((l) => {
            if (lineKey(l) !== key) return l;
            const capped = l.stock !== null ? Math.min(quantity, l.stock) : quantity;
            return { ...l, quantity: capped };
          }),
    );
  };

  const subtotal = r3(cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const discountRaw = parseFloat(discountValue) || 0;
  const discountNum = r3(Math.min(Math.max(discountMode === "percent" ? (subtotal * discountRaw) / 100 : discountRaw, 0), subtotal));
  const total = r3(subtotal - discountNum);
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);

  // ── hold / resume ──
  const holdCart = () => {
    if (cart.length === 0) return;
    const entry: HeldCart = {
      id: `${Date.now()}`,
      label: customer?.nameEn || customerName || `Cart ${held.length + 1}`,
      cart,
      discountMode,
      discountValue,
      customerPhone,
      customerName,
      at: new Date().toISOString(),
    };
    const next = [entry, ...held];
    setHeld(next);
    writeHeld(next);
    resetSale();
  };

  const resumeHeld = (h: HeldCart) => {
    if (cart.length > 0) holdCart();
    setCart(h.cart);
    setDiscountMode(h.discountMode);
    setDiscountValue(h.discountValue);
    setCustomerPhone(h.customerPhone);
    setCustomerName(h.customerName);
    const next = readHeld().filter((x) => x.id !== h.id);
    setHeld(next);
    writeHeld(next);
    setHeldOpen(false);
  };

  const dropHeld = (id: string) => {
    const next = held.filter((x) => x.id !== id);
    setHeld(next);
    writeHeld(next);
  };

  // ── payment ──
  const openPay = (mode: PayMode = "CASH") => {
    if (cart.length === 0) return;
    setPayMode(mode);
    setTendered("");
    setSplitCash("");
    setCheckoutError("");
    setPayOpen(true);
  };

  const tenderedNum = parseFloat(tendered) || 0;
  const splitCashNum = Math.min(Math.max(parseFloat(splitCash) || 0, 0), total);
  const cashDue = payMode === "CASH" ? total : payMode === "SPLIT" ? splitCashNum : 0;
  const change = cashDue > 0 && tendered !== "" ? r3(tenderedNum - cashDue) : 0;
  const canPay =
    cart.length > 0 &&
    !checkingOut &&
    (payMode === "CARD" || tendered === "" || tenderedNum + 0.0005 >= cashDue) &&
    (payMode !== "SPLIT" || (splitCashNum > 0 && splitCashNum < total));

  const completeSale = async () => {
    if (!canPay) return;
    setCheckingOut(true);
    setCheckoutError("");
    const payments =
      payMode === "CASH"
        ? [{ method: "CASH", amount: total }]
        : payMode === "CARD"
          ? [{ method: "CARD", amount: total }]
          : [
              { method: "CASH", amount: r3(splitCashNum) },
              { method: "CARD", amount: r3(total - splitCashNum) },
            ];
    const amountTendered = cashDue > 0 ? (tendered === "" ? cashDue : tenderedNum) : undefined;
    try {
      const data = await postJson<{ orderNumber: string; createdAt: string }>("/api/pos/checkout", {
        items: cart.map((l) => ({ productId: l.productId, variantId: l.variantId || undefined, quantity: l.quantity })),
        payments,
        amountTendered,
        discount: discountNum,
        customerPhone: customerPhone.trim() || undefined,
        customerName: customerName.trim() || undefined,
      });
      if (!data.success) {
        setCheckoutError(data.error || "Could not complete the sale.");
        beep("error");
        return;
      }
      setReceipt({
        orderNumber: data.data!.orderNumber,
        items: cart.map((l) => ({
          name: l.nameEn,
          nameAr: l.nameAr,
          variant: formatVariantLabel(l),
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: r3(l.unitPrice * l.quantity),
        })),
        subtotal,
        discount: discountNum,
        total,
        payments,
        amountTendered: amountTendered ?? null,
        changeGiven: amountTendered != null ? r3(amountTendered - cashDue) : null,
        cashierName,
        customerName: customer?.nameEn || customerName || undefined,
        createdAt: new Date().toISOString(),
      });
      setPayOpen(false);
      setCartOpen(false);
      resetSale();
      setScreen("receipt");
      loadShift();
    } catch {
      setCheckoutError("Something went wrong. Try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  // ── keyboard shortcuts on the terminal ──
  useEffect(() => {
    if (screen !== "terminal") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        scanInputRef.current?.focus();
        scanInputRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        holdCart();
      } else if (e.key === "F8") {
        e.preventDefault();
        openPay("CARD");
      } else if (e.key === "F9") {
        e.preventDefault();
        openPay("CASH");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  // ───────────────────────── render ─────────────────────────

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LuLoaderCircle size={28} className="animate-spin text-rose-400" />
      </div>
    );
  }

  if (screen === "picker") {
    return (
      <PosBackdrop>
        <div className="w-16 h-16 rounded-2xl bg-white/80 shadow-lg flex items-center justify-center mb-4">
          <LuScanBarcode size={30} className="text-rose-500" />
        </div>
        <h1 className="text-3xl font-semibold text-slate-800 mb-1">Hala Dresses POS</h1>
        <p className="text-slate-500 mb-10">Tap your name to sign in</p>
        {loadingStaff ? (
          <LuLoaderCircle size={24} className="animate-spin text-slate-400" />
        ) : staff.length === 0 ? (
          <div className="w-full max-w-lg bg-white/95 backdrop-blur rounded-3xl shadow-xl p-7 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center"><LuUsers size={24} /></span>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Set up your cashiers</h2>
                <p className="text-sm text-slate-500">No staff have a POS PIN yet. It takes a minute:</p>
              </div>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3"><span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><LuShieldCheck size={15} /></span><span className="text-slate-600 pt-1"><strong className="text-slate-800">Roles</strong> — make sure the cashier&apos;s role has &ldquo;Use POS&rdquo;.</span></li>
              <li className="flex gap-3"><span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><LuKeyRound size={15} /></span><span className="text-slate-600 pt-1"><strong className="text-slate-800">Users</strong> — open the staff member and set a 4-digit POS PIN.</span></li>
              <li className="flex gap-3"><span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><LuScanBarcode size={15} /></span><span className="text-slate-600 pt-1">Come back here — their name appears and they sign in with the PIN.</span></li>
            </ol>
            <div className="grid sm:grid-cols-2 gap-2.5 mt-6">
              <a href="/admin/users" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 text-white px-5 py-3 font-medium hover:bg-slate-900"><LuUsers size={17} /> Manage staff</a>
              <button onClick={loadStaff} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 text-slate-700 px-5 py-3 font-medium hover:bg-slate-50"><LuRotateCcw size={17} /> Refresh</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-3xl w-full">
            {staff.map((s) => (
              <button
                key={s.id}
                onClick={() => pickStaff(s)}
                className="group flex flex-col items-center gap-3 bg-white/90 backdrop-blur rounded-3xl border border-white shadow-sm p-6 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-100 to-amber-50 text-rose-500 flex items-center justify-center overflow-hidden ring-4 ring-white shadow">
                  {s.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatar} alt={s.nameEn} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-semibold">{(s.nameEn || s.nameAr || "?").charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="font-medium text-slate-700 text-center group-hover:text-rose-600">{s.nameEn || s.nameAr}</span>
              </button>
            ))}
          </div>
        )}
      </PosBackdrop>
    );
  }

  if (screen === "pin" && selectedStaff) {
    return (
      <PosBackdrop>
        <div className="bg-white/90 backdrop-blur rounded-3xl shadow-xl p-8 w-full max-w-[360px] flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
            <LuLock size={24} />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-1">{selectedStaff.nameEn || selectedStaff.nameAr}</h2>
          <p className="text-slate-500 mb-6">Enter your 4-digit PIN</p>
          <div className={`flex gap-3 mb-4 ${pinError ? "pos-shake" : ""}`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < pin.length ? "bg-rose-500 border-rose-500 scale-110" : "border-slate-300"}`} />
            ))}
          </div>
          <div className="h-6 mb-2 text-sm">
            {pinError ? <span className="text-rose-600">{pinError}</span> : pinSubmitting ? <LuLoaderCircle size={18} className="animate-spin text-slate-400" /> : null}
          </div>
          <div className="grid grid-cols-3 gap-3 w-full">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <PadKey key={d} onClick={() => pressDigit(d)} disabled={pinSubmitting}>{d}</PadKey>
            ))}
            <button onClick={() => { setSelectedStaff(null); setScreen("picker"); }} className="h-16 rounded-2xl text-sm font-medium text-slate-500 hover:bg-slate-100">
              Back
            </button>
            <PadKey onClick={() => pressDigit("0")} disabled={pinSubmitting}>0</PadKey>
            <button onClick={() => setPin((p) => p.slice(0, -1))} disabled={pinSubmitting} className="h-16 rounded-2xl text-slate-500 hover:bg-slate-100 flex items-center justify-center disabled:opacity-40" aria-label="Backspace">
              <LuDelete size={22} />
            </button>
          </div>
        </div>
      </PosBackdrop>
    );
  }

  if (screen === "openShift") {
    return (
      <PosBackdrop>
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-xl p-8 w-full max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <LuWallet size={26} />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800">Open your shift</h2>
          <p className="text-slate-500 mt-1 mb-6">Hi {cashierName}! Count the cash in the drawer to start the day.</p>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Opening cash (float)</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              autoFocus
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && openShift()}
              className="w-full text-2xl font-semibold pl-4 pr-16 py-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">OMR</span>
          </div>
          {shiftError && <p className="text-rose-600 text-sm mt-3">{shiftError}</p>}
          <button onClick={openShift} disabled={shiftBusy} className="mt-6 w-full py-4 rounded-2xl bg-emerald-500 text-white font-semibold text-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {shiftBusy ? <LuLoaderCircle className="animate-spin" /> : <LuPlay />} Start shift
          </button>
          {canOpenAdmin && (
            <a href="/admin" className="mt-3 w-full py-3 rounded-2xl text-slate-700 bg-slate-100 hover:bg-slate-200 text-sm font-medium flex items-center justify-center gap-2">
              <LuLayoutDashboard size={16} /> Back to admin
            </a>
          )}
          <button onClick={switchUser} className="mt-2 w-full py-3 rounded-2xl text-slate-500 hover:bg-slate-100 text-sm">
            Not you? Switch user
          </button>
        </div>
      </PosBackdrop>
    );
  }

  if (screen === "receipt" && receipt) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center bg-slate-100">
        <div className="print:hidden mb-5 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 pos-pop-in">
            <LuReceipt size={30} />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800">Sale complete</h2>
          {receipt.changeGiven != null && receipt.changeGiven > 0 && (
            <p className="mt-2 text-lg">
              Change due: <span className="font-bold text-emerald-600 text-2xl">{omr(receipt.changeGiven)}</span>
            </p>
          )}
        </div>
        <Receipt data={receipt} store={storeInfo} />
        <div className="flex gap-3 mt-6 print:hidden">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 text-white px-6 py-3 font-medium hover:bg-slate-900">
            <LuPrinter size={18} /> Print
          </button>
          <button autoFocus onClick={() => { setReceipt(null); setScreen("terminal"); }} className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 text-white px-6 py-3 font-medium hover:bg-rose-600">
            <LuPlus size={18} /> New sale
          </button>
        </div>
      </div>
    );
  }

  if (screen === "zreport" && zReport) {
    const diff = zReport.difference ?? 0;
    const balanced = Math.abs(diff) < 0.0005;
    return (
      <PosBackdrop>
        <div className="w-full max-w-4xl grid md:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-xl p-7 sm:p-8 print:hidden">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center pos-pop-in"><LuCircleCheck size={26} /></span>
              <div>
                <h2 className="text-2xl font-semibold text-slate-800">Shift closed</h2>
                <p className="text-slate-500 text-sm">
                  {zReport.cashierName} · {new Date(zReport.openedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} –{" "}
                  {zReport.closedAt && new Date(zReport.closedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Sales" value={String(zReport.salesCount)} />
              <Stat label="Sales total" value={omr(zReport.salesTotal)} />
              <Stat label="Cash taken" value={omr(zReport.byMethod.CASH ?? 0)} />
              <Stat label="Card taken" value={omr(zReport.byMethod.CARD ?? 0)} />
            </div>
            <div className={`mt-4 rounded-2xl p-4 flex items-center justify-between ${balanced ? "bg-emerald-50 text-emerald-800" : diff > 0 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700"}`}>
              <div>
                <p className="font-medium">{balanced ? "Drawer balanced" : diff > 0 ? "Drawer over" : "Drawer short"}</p>
                <p className="text-xs opacity-80">Expected {zReport.expectedCash.toFixed(3)} · counted {(zReport.closingCash ?? 0).toFixed(3)}</p>
              </div>
              <span className="text-2xl font-bold tabular-nums">{balanced ? "✓" : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(3)}`}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5 mt-6">
              {canOpenAdmin && (
                <a href="/admin" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 text-white px-5 py-3.5 font-medium hover:bg-slate-900">
                  <LuLayoutDashboard size={18} /> Back to admin
                </a>
              )}
              <button onClick={() => { setZReport(null); setOpeningCash("0"); setScreen("openShift"); }} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-white px-5 py-3.5 font-medium hover:bg-emerald-600">
                <LuPlay size={18} /> Open a new shift
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 text-slate-700 px-5 py-3.5 font-medium hover:bg-slate-50">
                <LuPrinter size={18} /> Print Z-report
              </button>
              <button onClick={() => { setZReport(null); switchUser(); }} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 text-slate-500 px-5 py-3.5 font-medium hover:text-rose-600">
                <LuLogOut size={18} /> Sign out
              </button>
            </div>
          </div>
          <div className="flex justify-center"><ShiftReport s={zReport} store={storeInfo} /></div>
        </div>
      </PosBackdrop>
    );
  }

  // ── terminal ──
  const cartPanel = (
    <CartPanel
      cart={cart}
      lastAddedKey={lastAddedKey}
      updateQty={updateQty}
      subtotal={subtotal}
      discountMode={discountMode}
      setDiscountMode={setDiscountMode}
      discountValue={discountValue}
      setDiscountValue={setDiscountValue}
      discountNum={discountNum}
      total={total}
      itemCount={itemCount}
      customerPhone={customerPhone}
      setCustomerPhone={setCustomerPhone}
      customerName={customerName}
      setCustomerName={setCustomerName}
      customer={customer}
      onClear={resetSale}
      onHold={holdCart}
      onPay={openPay}
    />
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-100 overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-2 bg-white border-b border-slate-200 px-3 sm:px-5 h-14 shrink-0 print:hidden">
        <div className="flex items-center gap-2 font-semibold text-slate-800 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
            <LuScanBarcode size={18} />
          </span>
          <span className="hidden md:inline truncate">Hala POS</span>
        </div>
        {shift && (
          <button onClick={() => setCloseOpen(true)} className="hidden sm:inline-flex items-center gap-1.5 ml-2 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 hover:bg-emerald-100" title="Shift details / close shift">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Shift · {shift.salesCount} sales · {omr(shift.salesTotal)}
          </button>
        )}
        <div className="flex-1" />
        <HeaderBtn icon={LuPause} label="Held" badge={held.length} onClick={() => setHeldOpen(true)} />
        <HeaderBtn icon={LuHistory} label="Sales" onClick={() => setSalesOpen(true)} />
        <HeaderBtn icon={LuRotateCcw} label="Return" onClick={() => setReturnOpen(true)} />
        <HeaderBtn icon={LuArrowDownToLine} label="Cash in" onClick={() => setCashOpen("IN")} className="hidden lg:inline-flex" />
        <HeaderBtn icon={LuArrowUpFromLine} label="Cash out" onClick={() => setCashOpen("OUT")} className="hidden lg:inline-flex" />
        <HeaderBtn icon={LuLock} label="Close shift" onClick={() => setCloseOpen(true)} />
        <HeaderBtn icon={LuMaximize} label="Fullscreen" onClick={toggleFullscreen} className="hidden md:inline-flex" />
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 px-2">
          <LuClock size={14} /> {now?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
        {canOpenAdmin && (
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-xl px-3 py-2 ml-1"
            title="Back to admin panel (you stay signed in)"
          >
            <LuLayoutDashboard size={16} />
            <span className="hidden sm:inline">Admin</span>
          </a>
        )}
        <button onClick={switchUser} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-rose-600 pl-2 border-l border-slate-200 ml-1" title="Switch cashier (signs out)">
          <LuUser size={16} />
          <span className="hidden sm:inline max-w-[120px] truncate">{cashierName}</span>
          <LuLogOut size={15} />
        </button>
      </header>

      <div className="flex-1 flex min-h-0 print:hidden">
        {/* Catalog */}
        <section className="flex-1 flex flex-col min-w-0 p-3 sm:p-4 gap-3">
          <form onSubmit={handleScanSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <LuScanBarcode size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={scanInputRef}
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                placeholder="Scan barcode or search name / SKU…  (F2)"
                className="w-full pl-11 pr-10 py-3.5 rounded-2xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-rose-300 shadow-sm"
                autoComplete="off"
              />
              {scanValue && (
                <button type="button" onClick={() => setScanValue("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear">
                  <LuX size={18} />
                </button>
              )}
            </div>
            <button type="submit" className="px-5 rounded-2xl bg-slate-800 text-white hover:bg-slate-900" aria-label="Search">
              <LuSearch size={20} />
            </button>
          </form>
          {scanError && <p className="text-rose-600 text-sm -mt-1 pos-shake">{scanError}</p>}

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 shrink-0">
            <Chip active={categoryFilter === ""} onClick={() => setCategoryFilter("")}>All</Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id === categoryFilter ? "" : c.id)}>
                {c.nameEn}
              </Chip>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 shrink-0">
            <button
              onClick={() => setInStockOnly((v) => !v)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border ${inStockOnly ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}
            >
              In stock only
            </button>
            {colorFacets.length > 0 && <span className="w-px h-5 bg-slate-200 mx-1 shrink-0" />}
            {colorFacets.map((c) => (
              <button
                key={c.value}
                onClick={() => setColorFilter(c.value === colorFilter ? "" : c.value)}
                title={c.value}
                aria-label={c.value}
                className={`w-7 h-7 rounded-full border-2 shrink-0 transition-transform ${colorFilter === c.value ? "border-rose-500 scale-110" : "border-transparent"}`}
              >
                <span className="block w-full h-full rounded-full border border-slate-200" style={{ background: c.hex || "#ccc" }} />
              </button>
            ))}
          </div>

          <div ref={catalogScrollRef} className="flex-1 overflow-y-auto rounded-2xl pb-24 lg:pb-2">
            {catalog.length === 0 && !catalogLoading ? (
              <div className="flex flex-col items-center justify-center text-slate-400 py-16">
                <LuPackageOpen size={36} className="mb-2" />
                <p className="text-sm">No matching products</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
                {catalog.map((r) => {
                  const outOfStock = r.stock !== null && r.stock <= 0;
                  const inCart = cart.find((l) => lineKey(l) === lineKey(r))?.quantity ?? 0;
                  return (
                    <button
                      key={`${r.productId}-${r.variantId ?? "base"}`}
                      onClick={() => !outOfStock && addLine(r)}
                      disabled={outOfStock}
                      className="relative text-left rounded-2xl bg-white overflow-hidden shadow-sm ring-1 ring-slate-200/70 hover:ring-rose-300 hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-45 disabled:active:scale-100"
                    >
                      <div className="aspect-[4/5] bg-slate-50 flex items-center justify-center overflow-hidden">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imageUrl} alt={r.nameEn} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <LuShoppingBag size={22} className="text-slate-300" />
                        )}
                      </div>
                      {inCart > 0 && (
                        <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center shadow">
                          {inCart}
                        </span>
                      )}
                      {r.stock !== null && r.stock > 0 && r.stock <= 3 && (
                        <span className="absolute top-2 left-2 text-[10px] font-semibold rounded-full bg-amber-400/95 text-white px-2 py-0.5">
                          {r.stock} left
                        </span>
                      )}
                      <div className="px-2.5 py-2">
                        <p className="text-[12px] font-medium text-slate-800 truncate leading-tight">{r.nameEn}</p>
                        <p className="text-[11px] text-slate-400 truncate leading-tight min-h-[14px]">{formatVariantLabel(r)}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[13px] font-semibold text-slate-800">{r.unitPrice.toFixed(3)}</span>
                          {outOfStock ? (
                            <span className="text-[10px] text-rose-500 font-medium">Sold out</span>
                          ) : r.stock !== null ? (
                            <span className="text-[10px] text-slate-400">{r.stock} pcs</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div ref={sentinelRef} className="h-10 flex items-center justify-center">
              {catalogLoading && <LuLoaderCircle className="animate-spin text-slate-400" />}
            </div>
          </div>
        </section>

        {/* Cart — desktop */}
        <aside className="hidden lg:flex w-[400px] xl:w-[430px] shrink-0 border-l border-slate-200 bg-white">{cartPanel}</aside>
      </div>

      {/* Cart — mobile bottom bar + drawer */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 p-3 print:hidden z-30">
        <button
          onClick={() => setCartOpen(true)}
          className="w-full flex items-center justify-between rounded-2xl bg-slate-900 text-white px-5 py-4 shadow-2xl"
        >
          <span className="flex items-center gap-2 font-medium">
            <LuShoppingBag size={20} /> {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
          <span className="font-semibold text-lg">{omr(total)}</span>
        </button>
      </div>
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 print:hidden">
          <div className="absolute inset-0 bg-slate-900/50 pos-fade-in" onClick={() => setCartOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 h-[88dvh] bg-white rounded-t-3xl flex flex-col pos-slide-up overflow-hidden">
            <div className="relative flex items-center justify-between px-5 pt-5 pb-1">
              <span className="w-10 h-1.5 rounded-full bg-slate-200 absolute left-1/2 -translate-x-1/2 top-2" />
              <h3 className="font-semibold text-slate-800">Current sale</h3>
              <button onClick={() => setCartOpen(false)} className="p-2 -m-2 text-slate-400" aria-label="Close cart">
                <LuX size={20} />
              </button>
            </div>
            {cartPanel}
          </div>
        </div>
      )}

      {/* Payment */}
      <PosModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={<span>Take payment · <span className="text-rose-600">{omr(total)}</span></span>}
        size="md"
      >
        <div className="grid grid-cols-3 gap-2 mb-5">
          {([
            { m: "CASH", icon: LuBanknote, label: "Cash" },
            { m: "CARD", icon: LuCreditCard, label: "Card" },
            { m: "SPLIT", icon: LuSplit, label: "Split" },
          ] as const).map(({ m, icon: Icon, label }) => (
            <button
              key={m}
              onClick={() => { setPayMode(m); setTendered(""); }}
              className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 font-medium transition-all ${
                payMode === m ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <Icon size={24} /> {label}
            </button>
          ))}
        </div>

        {payMode === "SPLIT" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Cash part</label>
            <MoneyInput value={splitCash} onChange={setSplitCash} autoFocus />
            <p className="text-sm text-slate-500 mt-1.5">
              Card part: <span className="font-semibold text-slate-800">{omr(r3(Math.max(total - splitCashNum, 0)))}</span>
            </p>
          </div>
        )}

        {cashDue > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Cash received</label>
            <MoneyInput value={tendered} onChange={setTendered} placeholder={cashDue.toFixed(3)} autoFocus={payMode === "CASH"} onEnter={completeSale} />
            <div className="flex flex-wrap gap-2 mt-2.5">
              {quickCash(cashDue).map((v) => (
                <button key={v} onClick={() => setTendered(v.toFixed(3))} className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200">
                  {v === r3(cashDue) ? "Exact" : v.toFixed(v % 1 ? 3 : 0)}
                </button>
              ))}
            </div>
            {tendered !== "" && (
              <div className={`mt-4 rounded-2xl p-4 flex items-center justify-between ${change >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
                <span className="font-medium">{change >= 0 ? "Change" : "Still due"}</span>
                <span className="text-2xl font-bold">{omr(Math.abs(change))}</span>
              </div>
            )}
          </div>
        )}

        {payMode === "CARD" && (
          <p className="text-slate-500 text-sm bg-slate-50 rounded-2xl p-4">Charge <strong className="text-slate-800">{omr(total)}</strong> on the card terminal, then confirm below.</p>
        )}

        {checkoutError && <p className="text-rose-600 text-sm mt-4">{checkoutError}</p>}

        <button
          onClick={completeSale}
          disabled={!canPay}
          className="mt-5 w-full py-4 rounded-2xl bg-emerald-500 text-white font-semibold text-lg hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {checkingOut ? <LuLoaderCircle size={20} className="animate-spin" /> : <>Complete sale · {omr(total)}</>}
        </button>
      </PosModal>

      {/* Held carts */}
      <PosModal open={heldOpen} onClose={() => setHeldOpen(false)} title="Held sales">
        {held.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No held sales. Use “Hold” (F4) to park a cart and serve the next customer.</p>
        ) : (
          <div className="space-y-2">
            {held.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 truncate">{h.label}</p>
                  <p className="text-xs text-slate-500">
                    {h.cart.reduce((s, l) => s + l.quantity, 0)} items · {omr(h.cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0))} ·{" "}
                    {new Date(h.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button onClick={() => resumeHeld(h)} className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-medium hover:bg-rose-600">Resume</button>
                <button onClick={() => dropHeld(h.id)} className="p-2 text-slate-400 hover:text-rose-500" aria-label="Discard"><LuTrash2 size={18} /></button>
              </div>
            ))}
          </div>
        )}
      </PosModal>

      <SalesModal open={salesOpen} onClose={() => setSalesOpen(false)} store={storeInfo} />
      <ReturnModal open={returnOpen} onClose={() => setReturnOpen(false)} onDone={() => { loadShift(); }} />
      <CashMovementModal type={cashOpen} onClose={() => setCashOpen(null)} onDone={(s) => setShift(s)} />
      <CloseShiftModal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        shift={shift}
        refresh={loadShift}
        onClosed={(s) => { setCloseOpen(false); setZReport(s); setShift(null); setScreen("zreport"); }}
      />
    </div>
  );
}

// ───────────────────────── pieces ─────────────────────────

function PosBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-gradient-to-br from-rose-50 via-amber-50/60 to-slate-100 relative overflow-hidden">
      <div aria-hidden className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-rose-200/40 blur-3xl" />
      <div aria-hidden className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-amber-200/40 blur-3xl" />
      <div className="relative z-10 flex flex-col items-center w-full">{children}</div>
    </div>
  );
}

function PadKey({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="h-16 rounded-2xl bg-white border border-slate-200 text-2xl font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 active:scale-95 transition disabled:opacity-40">
      {children}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
        active ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function HeaderBtn({
  icon: Icon,
  label,
  onClick,
  badge,
  className = "",
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  badge?: number;
  className?: string;
}) {
  return (
    <button onClick={onClick} title={label} className={`relative inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl px-2.5 py-2 ${className}`}>
      <Icon size={17} />
      <span className="hidden 2xl:inline">{label}</span>
      {!!badge && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>
      )}
    </button>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        min="0"
        step="0.001"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        className="w-full text-2xl font-semibold pl-4 pr-16 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-300"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">OMR</span>
    </div>
  );
}

/** Exact amount plus the next sensible banknote totals. */
function quickCash(due: number): number[] {
  const out = new Set<number>([r3(due)]);
  for (const step of [1, 5, 10, 20, 50]) {
    const v = Math.ceil(due / step) * step;
    if (v > due) out.add(v);
    if (out.size >= 5) break;
  }
  return Array.from(out).sort((a, b) => a - b);
}

function CartPanel(p: {
  cart: CartLine[];
  lastAddedKey: string | null;
  updateQty: (key: string, qty: number) => void;
  subtotal: number;
  discountMode: "amount" | "percent";
  setDiscountMode: (m: "amount" | "percent") => void;
  discountValue: string;
  setDiscountValue: (v: string) => void;
  discountNum: number;
  total: number;
  itemCount: number;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customer: Customer | null;
  onClear: () => void;
  onHold: () => void;
  onPay: (mode?: PayMode) => void;
}) {
  return (
    <div className="flex flex-col w-full min-h-0 flex-1">
      {/* Customer */}
      <div className="px-4 pt-3 pb-3 border-b border-slate-100 space-y-2">
        <div className="flex gap-2">
          <input
            value={p.customerPhone}
            onChange={(e) => p.setCustomerPhone(e.target.value)}
            placeholder="Customer phone"
            inputMode="tel"
            className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          {!p.customer && (
            <input
              value={p.customerName}
              onChange={(e) => p.setCustomerName(e.target.value)}
              placeholder="Name (optional)"
              className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          )}
        </div>
        {p.customer && (
          <div className="flex items-center gap-2 text-sm rounded-xl bg-emerald-50 text-emerald-800 px-3 py-2">
            <LuUserCheck size={16} />
            <span className="font-medium truncate">{p.customer.nameEn || p.customer.nameAr}</span>
            <span className="ml-auto text-xs text-emerald-700/80 shrink-0">{p.customer.orders} orders · {omr(p.customer.totalSpent)}</span>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-y-auto">
        {p.cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10 px-6 text-center">
            <LuScanBarcode size={40} className="mb-3 text-slate-300" />
            <p className="font-medium text-slate-500">Scan or tap an item</p>
            <p className="text-xs mt-1">F2 search · F4 hold · F8 card · F9 cash</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {p.cart.map((l) => {
              const key = lineKey(l);
              return (
                <li key={key} className={`flex items-center gap-3 px-4 py-3 transition-colors ${p.lastAddedKey === key ? "bg-rose-50" : ""}`}>
                  <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    {l.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.imageUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{l.nameEn}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {[formatVariantLabel(l), `${l.unitPrice.toFixed(3)} ea`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center rounded-xl border border-slate-200 shrink-0">
                    <button onClick={() => p.updateQty(key, l.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-rose-600" aria-label="Decrease">
                      <LuMinus size={14} />
                    </button>
                    <input
                      value={l.quantity}
                      onChange={(e) => p.updateQty(key, parseInt(e.target.value) || 0)}
                      inputMode="numeric"
                      className="w-8 text-center text-sm font-semibold bg-transparent focus:outline-none"
                      aria-label="Quantity"
                    />
                    <button
                      onClick={() => p.updateQty(key, l.quantity + 1)}
                      disabled={l.stock !== null && l.quantity >= l.stock}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-rose-600 disabled:opacity-30"
                      aria-label="Increase"
                    >
                      <LuPlus size={14} />
                    </button>
                  </div>
                  <span className="w-[72px] text-right text-sm font-semibold text-slate-800 shrink-0">{(l.unitPrice * l.quantity).toFixed(3)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-slate-200 px-4 py-3 space-y-2 bg-slate-50/60">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Subtotal · {p.itemCount} item{p.itemCount === 1 ? "" : "s"}</span>
          <span>{p.subtotal.toFixed(3)}</span>
        </div>
        <div className="flex justify-between items-center text-sm text-slate-600 gap-2">
          <span>Discount</span>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
              {(["amount", "percent"] as const).map((m) => (
                <button key={m} onClick={() => p.setDiscountMode(m)} className={`px-2 py-1 ${p.discountMode === m ? "bg-slate-800 text-white" : "bg-white text-slate-500"}`}>
                  {m === "amount" ? "OMR" : "%"}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={p.discountValue}
              onChange={(e) => p.setDiscountValue(e.target.value)}
              placeholder="0"
              className="w-20 text-right border border-slate-200 rounded-lg px-2 py-1 bg-white"
            />
            {p.discountNum > 0 && <span className="text-rose-600 text-xs w-14 text-right">−{p.discountNum.toFixed(3)}</span>}
          </div>
        </div>
        <div className="flex justify-between items-baseline pt-1">
          <span className="font-semibold text-slate-800">Total</span>
          <span className="text-2xl font-bold text-slate-900">{omr(p.total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 pt-1 grid grid-cols-4 gap-2 bg-slate-50/60">
        <button onClick={p.onClear} disabled={p.cart.length === 0} className="py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-rose-600 disabled:opacity-40 flex flex-col items-center text-xs gap-0.5" title="Clear sale">
          <LuTrash2 size={18} /> Clear
        </button>
        <button onClick={p.onHold} disabled={p.cart.length === 0} className="py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 disabled:opacity-40 flex flex-col items-center text-xs gap-0.5" title="Hold sale (F4)">
          <LuPause size={18} /> Hold
        </button>
        <button onClick={() => p.onPay("CARD")} disabled={p.cart.length === 0} className="py-3 rounded-2xl bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-40 flex flex-col items-center text-xs gap-0.5" title="Card (F8)">
          <LuCreditCard size={18} /> Card
        </button>
        <button onClick={() => p.onPay("CASH")} disabled={p.cart.length === 0} className="py-3 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 flex flex-col items-center text-xs gap-0.5 font-semibold" title="Cash (F9)">
          <LuBanknote size={18} /> Cash
        </button>
      </div>
    </div>
  );
}

function saleToReceipt(s: Sale): ReceiptData {
  return {
    orderNumber: s.orderNumber,
    items: s.items.map((it) => ({
      name: it.nameEn,
      variant: [it.color, it.size].filter(Boolean).join(" / "),
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total: it.total,
    })),
    subtotal: s.subtotal,
    discount: s.discount,
    total: s.total,
    payments: s.payments,
    amountTendered: s.amountTendered,
    changeGiven: s.changeGiven,
    cashierName: s.cashierName,
    customerName: s.customerName,
    createdAt: s.createdAt,
    title: "Copy",
  };
}

function SalesModal({ open, onClose, store }: { open: boolean; onClose: () => void; store: StoreInfo }) {
  const [scope, setScope] = useState<"shift" | "today">("shift");
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Sale | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/pos/orders?scope=${scope}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSales(d.success ? d.data : []))
      .finally(() => setLoading(false));
  }, [open, scope]);

  const sum = useMemo(() => sales.reduce((s, x) => s + x.total, 0), [sales]);

  return (
    <PosModal open={open} onClose={() => { setSelected(null); onClose(); }} title={selected ? `Sale ${selected.orderNumber}` : "Recent sales"} size="lg">
      {selected ? (
        <div className="flex flex-col items-center gap-4">
          <Receipt data={saleToReceipt(selected)} store={store} />
          <div className="flex gap-2">
            <button onClick={() => setSelected(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium">Back</button>
            <button onClick={() => window.print()} className="px-4 py-2.5 rounded-xl bg-slate-800 text-white font-medium inline-flex items-center gap-2"><LuPrinter size={16} /> Reprint</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm">
              {(["shift", "today"] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)} className={`px-4 py-1.5 rounded-lg font-medium ${scope === s ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
                  {s === "shift" ? "This shift" : "Today (all tills)"}
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-500">{sales.length} sales · <strong className="text-slate-800">{omr(sum)}</strong></span>
          </div>
          {loading ? (
            <div className="flex justify-center py-10"><LuLoaderCircle className="animate-spin text-slate-400" /></div>
          ) : sales.length === 0 ? (
            <p className="text-center text-slate-400 py-10">No sales yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sales.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setSelected(s)} className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 rounded-xl px-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">{s.orderNumber}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {new Date(s.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {s.items.reduce((n, i) => n + i.quantity, 0)} items ·{" "}
                        {s.payments.map((p) => methodLabel(p.method)).join(" + ")} {s.customerName && `· ${s.customerName}`}
                      </p>
                    </div>
                    {s.refundedAmount > 0 && <span className="text-[11px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">Returned {s.refundedAmount.toFixed(3)}</span>}
                    <span className="font-semibold text-slate-800">{s.total.toFixed(3)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PosModal>
  );
}

function CashMovementModal({ type, onClose, onDone }: { type: null | "IN" | "OUT"; onClose: () => void; onDone: (s: ShiftSummary) => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    const d = await postJson<ShiftSummary>("/api/pos/shift", { action: "movement", type, amount: parseFloat(amount) || 0, reason }).catch(() => null);
    setBusy(false);
    if (!d?.success) return setErr(d?.error || "Failed.");
    onDone(d.data!);
    setAmount("");
    setReason("");
    onClose();
  };

  return (
    <PosModal
      open={type !== null}
      onClose={onClose}
      title={type === "IN" ? "Cash in (pay-in)" : "Cash out (pay-out)"}
      size="sm"
      footer={
        <button onClick={submit} disabled={busy || !(parseFloat(amount) > 0) || !reason.trim()} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-medium disabled:opacity-40">
          {busy ? "Saving…" : "Record"}
        </button>
      }
    >
      <div className="space-y-3">
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "IN" ? "e.g. Extra change from bank" : "e.g. Bought cleaning supplies"} className="w-full border border-slate-200 rounded-xl px-3 py-2.5" />
        {err && <p className="text-rose-600 text-sm">{err}</p>}
      </div>
    </PosModal>
  );
}

function CloseShiftModal({
  open,
  onClose,
  shift,
  refresh,
  onClosed,
}: {
  open: boolean;
  onClose: () => void;
  shift: ShiftSummary | null;
  refresh: () => Promise<ShiftSummary | null>;
  onClosed: (s: ShiftSummary) => void;
}) {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!shift) return null;
  const countedNum = parseFloat(counted);
  const diff = counted === "" ? null : r3(countedNum - shift.expectedCash);

  const submit = async () => {
    setBusy(true);
    setErr("");
    const d = await postJson<ShiftSummary>("/api/pos/shift", { action: "close", closingCash: countedNum || 0, notes: notes || undefined }).catch(() => null);
    setBusy(false);
    if (!d?.success) return setErr(d?.error || "Could not close the shift.");
    setCounted("");
    setNotes("");
    onClosed(d.data!);
  };

  return (
    <PosModal
      open={open}
      onClose={onClose}
      title="Shift summary"
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium">Keep selling</button>
          <button onClick={submit} disabled={busy || counted === ""} className="px-5 py-2.5 rounded-xl bg-rose-500 text-white font-medium disabled:opacity-40">
            {busy ? "Closing…" : "Close shift & print Z-report"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="Sales" value={`${shift.salesCount}`} />
        <Stat label="Sales total" value={omr(shift.salesTotal)} />
        <Stat label="Cash taken" value={omr(shift.byMethod.CASH ?? 0)} />
        <Stat label="Card taken" value={omr(shift.byMethod.CARD ?? 0)} />
        <Stat label="Refunds" value={omr(shift.refunds)} />
        <Stat label="Pay-ins / outs" value={`+${shift.payIns.toFixed(3)} / −${shift.payOuts.toFixed(3)}`} />
      </div>
      <div className="rounded-2xl bg-slate-800 text-white p-4 flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-slate-300">Expected cash in drawer</p>
          <p className="text-xs text-slate-400">Opening {shift.openingCash.toFixed(3)} + cash sales + pay-ins − pay-outs − cash refunds</p>
        </div>
        <span className="text-2xl font-bold">{shift.expectedCash.toFixed(3)}</span>
      </div>
      <label className="block text-sm font-medium text-slate-600 mb-1.5">Counted cash</label>
      <MoneyInput value={counted} onChange={setCounted} />
      {diff !== null && (
        <p className={`mt-2 text-sm font-medium ${Math.abs(diff) < 0.0005 ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-rose-600"}`}>
          {Math.abs(diff) < 0.0005 ? "Drawer balances ✓" : diff > 0 ? `Over by ${omr(diff)}` : `Short by ${omr(-diff)}`}
        </p>
      )}
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="mt-3 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
      {err && <p className="text-rose-600 text-sm mt-2">{err}</p>}
    </PosModal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

function ShiftReport({ s, store }: { s: ShiftSummary; store: StoreInfo }) {
  const line = (label: string, v: number | string) => (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{typeof v === "number" ? v.toFixed(3) : v}</span>
    </div>
  );
  return (
    <div className="pos-receipt w-full max-w-[340px] bg-white rounded-2xl shadow-sm border border-slate-200 p-5 font-mono text-[13px] text-slate-800">
      <p className="text-center font-bold text-base">{store.store_name_en || "Hala Dresses"}</p>
      <p className="text-center font-semibold tracking-wider mt-1">Z-REPORT · SHIFT CLOSE</p>
      <div className="border-t border-dashed border-slate-300 my-2" />
      {line("Cashier", s.cashierName)}
      {line("Opened", new Date(s.openedAt).toLocaleString("en-GB"))}
      {s.closedAt && line("Closed", new Date(s.closedAt).toLocaleString("en-GB"))}
      <div className="border-t border-dashed border-slate-300 my-2" />
      {line("Sales count", String(s.salesCount))}
      {line("Sales total", s.salesTotal)}
      {line("Discounts", s.discounts)}
      {Object.entries(s.byMethod).map(([m, v]) => <div key={m}>{line(`  ${methodLabel(m)}`, v)}</div>)}
      {line("Refunds", s.refunds)}
      <div className="border-t border-dashed border-slate-300 my-2" />
      {line("Opening cash", s.openingCash)}
      {line("Pay-ins", s.payIns)}
      {line("Pay-outs", s.payOuts)}
      {line("Cash refunds", s.cashRefunds)}
      {line("Expected cash", s.expectedCash)}
      {s.closingCash != null && line("Counted cash", s.closingCash)}
      {s.difference != null && (
        <div className="flex justify-between font-bold mt-1">
          <span>Difference</span>
          <span>{s.difference.toFixed(3)}</span>
        </div>
      )}
    </div>
  );
}
