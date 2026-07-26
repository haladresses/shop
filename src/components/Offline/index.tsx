import React from "react";
import Image from "next/image";
import Link from "next/link";

const Offline = () => {
  return (
    <section className="overflow-hidden py-20 bg-gray-2 min-h-screen flex items-center">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <div className="bg-white rounded-xl shadow-1 px-4 py-10 sm:py-15 lg:py-20 xl:py-25">
          <div className="text-center">
            <Image
              src="/logo.svg"
              alt="Hala Dresses"
              width={64}
              height={64}
              className="mx-auto mb-6 opacity-70"
            />
            <h2 className="font-bold text-blue text-4xl lg:text-[45px] lg:leading-[57px] mb-5">
              You&apos;re Offline
            </h2>

            <p className="max-w-[491px] w-full mx-auto mb-7.5">
              It looks like you&apos;ve lost your internet connection. Some pages you&apos;ve
              already visited may still be available — otherwise, please reconnect and try
              again.
            </p>

            <Link
              href="/"
              className="inline-flex items-center gap-2 font-medium text-white bg-blue py-3 px-6 rounded-md ease-out duration-200 hover:bg-blue-dark"
            >
              Try Again
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Offline;
