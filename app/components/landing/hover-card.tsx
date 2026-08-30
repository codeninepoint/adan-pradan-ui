type HoverCardProps = {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "article" | "blockquote";
};

export function HoverCard({
  children,
  className = "",
  as: Tag = "div",
}: HoverCardProps) {
  return (
    <Tag
      className={`transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.02] hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 hover:z-10 ${className}`}
    >
      {children}
    </Tag>
  );
}
