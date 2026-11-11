const LANES = [
  ["Server Survival", "Java Edition", "Bedrock Edition", "Rank per season", "Kit per season", "CipiSMP Store"],
  ["CipiSMP", "Survival SMP", "Java × Bedrock", "Pilih rank", "Pilih kit", "Pengiriman otomatis"],
];

export function DoubleMarquee() {
  return (
    <section className="double-marquee" aria-label="Informasi server CipiSMP">
      <p className="sr-only">
        CipiSMP adalah server survival untuk Java dan Bedrock. Rank dan kit tersedia per season.
      </p>
      <div className="double-marquee__visual" aria-hidden="true">
        {LANES.map((items, laneIndex) => (
          <div
            key={laneIndex}
            className={`double-marquee__lane ${laneIndex === 1 ? "double-marquee__lane--reverse" : ""}`}
          >
            <div className={`double-marquee__track ${laneIndex === 1 ? "double-marquee__track--reverse" : ""}`}>
              {[0, 1].map((copyIndex) => (
                <div
                  key={copyIndex}
                  className="double-marquee__group"
                  data-marquee-copy={copyIndex === 1 ? "duplicate" : "main"}
                >
                  {items.map((item) => (
                    <span key={item} className="double-marquee__item">
                      <span className="double-marquee__spark" />
                      {item}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
