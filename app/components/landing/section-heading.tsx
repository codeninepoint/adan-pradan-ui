type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
};

export function SectionHeading({ title, eyebrow }: SectionHeadingProps) {
  return (
    <div>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
          {eyebrow}
        </p>
      )}
      <h2
        className={`landing-section-title text-foreground ${eyebrow ? "mt-1" : ""}`}
      >
        {title}
      </h2>
    </div>
  );
}
