"use client";
import { useEffect } from "react";
import { useCartModalContext } from "@/app/context/CartSidebarModalContext";
import { removeItemFromCart, selectTotalPrice } from "@/redux/features/cart-slice";
import { useAppSelector } from "@/redux/store";
import { useSelector } from "react-redux";
import { useLanguage } from "@/app/context/LanguageContext";
import SingleItem from "./SingleItem";
import Link from "next/link";
import EmptyCart from "./EmptyCart";

const CartSidebarModal = () => {
  const { isCartModalOpen, closeCartModal } = useCartModalContext();
  const { isArabic } = useLanguage();
  const cartItems = useAppSelector((state) => state.cartReducer.items);
  const totalPrice = useSelector(selectTotalPrice);
  const itemCount = cartItems.reduce((n, i) => n + i.quantity, 0);
  // Mirrors the server rule in /api/orders: free standard shipping from 10 OMR.
  const FREE_SHIPPING_FROM = 10;
  const toFree = Math.max(0, FREE_SHIPPING_FROM - totalPrice);

  const copy = isArabic
    ? { title: "سلة التسوق", subtotal: "المجموع:", viewCart: "عرض السلة", checkout: "الدفع" }
    : { title: "Cart", subtotal: "Subtotal:", viewCart: "View Cart", checkout: "Checkout" };

  useEffect(() => {
    function handleClickOutside(event) {
      if (!event.target.closest(".modal-content")) {
        closeCartModal();
      }
    }
    if (isCartModalOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCartModalOpen, closeCartModal]);

  return (
    <div
      className={`fixed top-0 left-0 z-99999 w-full h-screen bg-dark/70 ease-linear duration-300 ${
        isCartModalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Panel — slides from left in Arabic, right in English */}
      <div
        dir={isArabic ? "rtl" : "ltr"}
        className={`modal-content fixed top-0 h-full w-full max-w-[500px] bg-white shadow-1 flex flex-col ease-in-out duration-300 ${
          isArabic ? "left-0" : "right-0"
        } ${
          isCartModalOpen
            ? "translate-x-0"
            : isArabic
            ? "-translate-x-full"
            : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-7.5 lg:px-11 py-4 sm:py-7.5 border-b border-gray-3">
          <h2 className="font-semibold text-dark text-lg sm:text-2xl flex items-baseline gap-2">
            {copy.title}
            {itemCount > 0 && (
              <span key={itemCount} className="fx-badge-pop !delay-0 text-sm font-medium text-dark-4">
                ({itemCount} {isArabic ? (itemCount === 1 ? "قطعة" : "قطع") : itemCount === 1 ? "item" : "items"})
              </span>
            )}
          </h2>
          <button
            onClick={closeCartModal}
            aria-label="close cart"
            className="flex items-center justify-center text-dark-4 hover:text-dark ease-in duration-150"
          >
            <svg className="fill-current" width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5379 11.2121C12.1718 10.846 11.5782 10.846 11.212 11.2121C10.8459 11.5782 10.8459 12.1718 11.212 12.5379L13.6741 15L11.2121 17.4621C10.846 17.8282 10.846 18.4218 11.2121 18.7879C11.5782 19.154 12.1718 19.154 12.5379 18.7879L15 16.3258L17.462 18.7879C17.8281 19.154 18.4217 19.154 18.7878 18.7879C19.154 18.4218 19.154 17.8282 18.7878 17.462L16.3258 15L18.7879 12.5379C19.154 12.1718 19.154 11.5782 18.7879 11.2121C18.4218 10.846 17.8282 10.846 17.462 11.2121L15 13.6742L12.5379 11.2121Z" fill=""/>
              <path fillRule="evenodd" clipRule="evenodd" d="M15 1.5625C7.57867 1.5625 1.5625 7.57867 1.5625 15C1.5625 22.4213 7.57867 28.4375 15 28.4375C22.4213 28.4375 28.4375 22.4213 28.4375 15C28.4375 7.57867 22.4213 1.5625 15 1.5625ZM3.4375 15C3.4375 8.61421 8.61421 3.4375 15 3.4375C21.3858 3.4375 26.5625 8.61421 26.5625 15C26.5625 21.3858 21.3858 26.5625 15 26.5625C8.61421 26.5625 3.4375 21.3858 3.4375 15Z" fill=""/>
            </svg>
          </button>
        </div>

        {cartItems.length > 0 && (
          <div className="px-4 sm:px-7.5 lg:px-11 pt-4">
            <p className="text-sm text-dark-3 mb-2">
              {toFree > 0
                ? isArabic
                  ? `أضيفي ${toFree.toFixed(3)} ر.ع. للحصول على شحن مجاني`
                  : `Add ${toFree.toFixed(3)} OMR more for free shipping`
                : isArabic
                  ? "🎉 حصلتِ على شحن مجاني"
                  : "🎉 You've unlocked free shipping"}
            </p>
            <div className="h-1.5 rounded-full bg-gray-2 overflow-hidden">
              <div className="h-full rounded-full bg-blue transition-[width] duration-500" style={{ width: `${Math.min(100, (totalPrice / FREE_SHIPPING_FROM) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 sm:px-7.5 lg:px-11 py-6">
          <div className="flex flex-col gap-6">
            {cartItems.length > 0 ? (
              cartItems.map((item) => (
                <SingleItem key={item.id} item={item} removeItemFromCart={removeItemFromCart} />
              ))
            ) : (
              <EmptyCart />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-7.5 lg:px-11 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] border-t border-gray-3">
          <div className="flex items-center justify-between gap-5 mb-5">
            <p className="font-medium text-xl text-dark">{copy.subtotal}</p>
            <p className="font-medium text-xl text-dark">
              {totalPrice.toFixed(3)} {isArabic ? "ر.ع." : "OMR"}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link
              onClick={closeCartModal}
              href="/cart"
              className="w-full flex justify-center font-semibold text-dark bg-white ring-1 ring-gray-3 py-[13px] px-6 rounded-full ease-out duration-200 hover:ring-blue/40"
            >
              {copy.viewCart}
            </Link>
            <Link
              onClick={closeCartModal}
              href="/checkout"
              className="w-full flex justify-center font-semibold text-white bg-dark py-[13px] px-6 rounded-full ease-out duration-200 hover:bg-blue"
            >
              {copy.checkout}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartSidebarModal;
