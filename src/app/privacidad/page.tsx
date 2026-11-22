import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Qué datos usa EcoPuntos, para qué y cuánto tiempo los guarda.",
};

// Contacto para dudas o para pedir ver, corregir o borrar datos (PRIVACY_CONTACT_EMAIL en .env).
const contact = process.env.PRIVACY_CONTACT_EMAIL;

export default function PrivacidadPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6 text-sm leading-relaxed">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Aviso de privacidad</h1>
          <p className="text-muted-foreground">Última actualización: 22 de noviembre de 2026.</p>
        </div>

        <p>
          EcoPuntos es un proyecto escolar de Desarrollo Sustentable que funciona como piloto durante dos a tres semanas.
          Este aviso explica qué datos usamos, para qué y cuánto tiempo los guardamos.
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Qué datos recabamos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>De tu cuenta: nombre, correo y contraseña. La contraseña se guarda cifrada; nadie la puede ver.</li>
            <li>Tus movimientos de puntos: compras en el stand, envases, reciclaje, retos y canjes.</li>
            <li>
              De tus recibos de luz o agua: número de servicio, periodo y consumo. También la foto o el PDF que subes, que
              puede incluir tu nombre y tu dirección.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Para qué los usamos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Darte puntos y revisar que cada ticket, recibo o reciclaje sea real y pague una sola vez.</li>
            <li>
              Medir el impacto del piloto (luz, agua, CO₂, envases y reciclaje) para el reporte escolar. El reporte usa
              totales y seudónimos, nunca tu nombre ni tu correo.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Quién los ve</h2>
          <p>
            Solo tú y las personas del equipo que validan recibos y reciclaje. No vendemos ni compartimos tus datos. La
            página pública de impacto muestra únicamente totales del piloto.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Cuánto tiempo los guardamos</h2>
          <p>
            Las fotos y los PDF de los recibos se borran al terminar el piloto. El resto de los datos se conserva solo
            mientras dure el proyecto escolar.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Tus derechos</h2>
          <p>
            Puedes pedir ver, corregir o borrar tus datos, o dejar de participar cuando quieras.{" "}
            {contact ? (
              <>
                Escríbenos a{" "}
                <a href={`mailto:${contact}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {contact}
                </a>
                .
              </>
            ) : (
              "Pídelo a cualquier persona del equipo en el stand."
            )}
          </p>
        </section>

        <p className="text-muted-foreground">Si este aviso cambia, lo publicaremos en esta misma página.</p>
      </main>
    </>
  );
}
