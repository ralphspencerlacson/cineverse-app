import { useEffect, useRef } from "react";

const useListingReveal = () => {
  const listingRef = useRef(null);

  useEffect(() => {
    const listing = listingRef.current;
    if (!listing) {
      return undefined;
    }

    const sections = Array.from(listing.children);
    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-revealed"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return listingRef;
};

export default useListingReveal;
