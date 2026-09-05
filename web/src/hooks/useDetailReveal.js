import { useEffect, useRef } from "react";

const useDetailReveal = (detailKey) => {
  const contentRef = useRef(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || !detailKey) {
      return undefined;
    }

    const sections = Array.from(content.children);
    sections.forEach((section) => section.classList.add("detail-reveal"));

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
      { rootMargin: "0px 0px -7%", threshold: 0.06 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [detailKey]);

  return contentRef;
};

export default useDetailReveal;
