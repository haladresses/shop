import React from "react";
import Link from "next/link";
import { useCartModalContext } from "@/app/context/CartSidebarModalContext";
import { useLanguage } from "@/app/context/LanguageContext";

const EmptyCart = () => {
  const { closeCartModal } = useCartModalContext();
  const { isArabic } = useLanguage();

  return (
    <div className="text-center">
      <div className="mx-auto pb-7.5">
        <div className="mx-auto w-[100px] h-[100px] rounded-full bg-gray-1 flex items-center justify-center">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" stroke="#8D93A5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="6" x2="21" y2="6" stroke="#8D93A5" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M16 10a4 4 0 01-8 0" stroke="#8D93A5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      <p className="font-medium text-dark">{isArabic ? "سلتك فارغة" : "Your cart is empty"}</p>
      <p className="pb-6 pt-1 text-sm text-dark-4">{isArabic ? "اكتشفي أحدث التشكيلات وأضيفي ما يعجبك." : "Discover the latest pieces and add your favourites."}</p>

      <Link
        onClick={() => closeCartModal()}
        href="/shop"
        className="w-full lg:w-10/12 mx-auto flex justify-center font-medium text-white bg-dark py-[13px] px-6 rounded-full ease-out duration-200 hover:bg-blue"
      >
        {isArabic ? "تابعي التسوق" : "Continue shopping"}
      </Link>
    </div>
  );
};

export default EmptyCart;
