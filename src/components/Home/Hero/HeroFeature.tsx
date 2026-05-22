"use client";

import Image from "next/image";
import { useLanguage } from "@/app/context/LanguageContext";

const HeroFeature = () => {
  const { isArabic } = useLanguage();

  const features = isArabic
    ? [
        { img: "/images/icons/icon-01.svg", title: "شحن مجاني", description: "لجميع الطلبات فوق 20 ر.ع." },
        { img: "/images/icons/icon-02.svg", title: "إرجاع سهل", description: "استرداد خلال يوم واحد" },
        { img: "/images/icons/icon-03.svg", title: "دفع آمن 100%", description: "حماية كاملة لبياناتك" },
        { img: "/images/icons/icon-04.svg", title: "دعم على مدار الساعة", description: "في أي وقت وأي مكان" },
      ]
    : [
        { img: "/images/icons/icon-01.svg", title: "Free Shipping", description: "On all orders over 20 OMR" },
        { img: "/images/icons/icon-02.svg", title: "Easy Returns", description: "Return within 1 day" },
        { img: "/images/icons/icon-03.svg", title: "100% Secure Payments", description: "Your data is protected" },
        { img: "/images/icons/icon-04.svg", title: "24/7 Support", description: "Anywhere & anytime" },
      ];

  return (
    <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0 mt-10">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((item, key) => (
          <div
            key={key}
            className={`flex items-center gap-4 bg-white rounded-xl px-5 py-4 shadow-sm ${isArabic ? "flex-row-reverse text-right" : ""}`}
          >
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#F7EDE7] flex items-center justify-center">
              <Image src={item.img} alt={item.title} width={22} height={22} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-dark leading-tight">{item.title}</h3>
              <p className="text-xs text-dark-4 mt-0.5">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroFeature;
