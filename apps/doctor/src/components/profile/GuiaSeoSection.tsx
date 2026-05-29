"use client";

export default function GuiaSeoSection() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Cover */}
      <div className="bg-gradient-to-br from-[#0f4c75] to-[#1b262c] text-white rounded-2xl px-6 py-16 sm:px-10 sm:py-20 text-center">
        <h1 className="text-2xl sm:text-4xl font-bold mb-4 leading-tight">
          Como Hacer que Tu Perfil Aparezca en Google
        </h1>
        <p className="text-base sm:text-lg opacity-85 max-w-lg mx-auto mb-6">
          Guia paso a paso para doctores registrados en tusalud.pro
        </p>
        <span className="inline-block border border-white/30 bg-white/15 rounded-full px-5 py-2 text-sm tracking-wide">
          tusalud.pro &mdash; Abril 2026
        </span>
      </div>

      {/* Intro */}
      <Section>
        <H2>Antes de empezar: Por que tu perfil aun no sale en Google?</H2>
        <P>
          Tu pagina en tusalud.pro ya esta <strong>tecnicamente optimizada</strong> para Google: tiene datos
          estructurados, sitemap, velocidad de carga rapida, y esta configurada para ser indexada. Eso ya esta hecho.
        </P>
        <P>
          Pero Google necesita <strong>mas que una pagina web</strong> para recomendarte a un paciente. Necesita
          confirmacion externa de que eres un profesional real, activo y confiable. Especificamente:
        </P>
        <Alert variant="info">
          <strong className="block mb-1">Google evalua 4 cosas antes de mostrarte:</strong>
          1. Que existas en Google Business Profile (tu tarjeta en Google Maps)<br />
          2. Que pacientes reales dejen resenas en Google<br />
          3. Que tu informacion sea IDENTICA en tusalud.pro y en Google<br />
          4. Que publiques contenido util regularmente
        </Alert>
        <P>
          Esta guia cubre exactamente que hacer para cada punto. Siguiendo estos pasos, tu perfil puede empezar a
          aparecer en busquedas como <em>&quot;oftalmologo en guadalajara&quot;</em> en 30-120 dias.
        </P>
      </Section>

      {/* Paso 1 */}
      <Section>
        <SectionNumber n={1} />
        <H2>Completa tu perfil en tusalud.pro al 100%</H2>
        <P>
          Google lee tu pagina en tusalud.pro y busca informacion completa. Un perfil incompleto le dice a Google que
          no eres confiable. Entra a tu dashboard y revisa cada seccion:
        </P>

        <Table
          headers={["Seccion", "Que llenar", "Por que importa"]}
          rows={[
            [
              <strong key="a">Info General</strong>,
              "Nombre con titulo, especialidad, subespecialidades, ciudad, anos de experiencia, biografia detallada (minimo 150 palabras), foto profesional",
              "Google verifica que eres un profesional real",
            ],
            [
              <strong key="b">Servicios</strong>,
              "TODOS tus servicios con descripcion, duracion y precio",
              "Aparecen como datos estructurados en Google",
            ],
            [
              <strong key="c">Clinica</strong>,
              "Direccion exacta, telefono, WhatsApp, horario de cada dia, coordenadas GPS",
              "Esta informacion DEBE ser identica a Google Business Profile",
            ],
            [
              <strong key="d">Formacion</strong>,
              "Escuela de medicina, residencia, certificaciones",
              "Google exige credenciales verificables en contenido de salud",
            ],
            [
              <strong key="e">Multimedia</strong>,
              "Minimo 5 fotos reales del consultorio y tuyas",
              "Estas mismas fotos van en Google Business Profile",
            ],
            [
              <strong key="f">FAQs</strong>,
              "Minimo 8 preguntas frecuentes con respuestas detalladas",
              "Cada FAQ puede aparecer expandible en resultados de Google",
            ],
            [
              <strong key="g">Opiniones</strong>,
              "Revisa que las opiniones de pacientes esten visibles",
              "Aparecen como estrellas en los resultados de Google",
            ],
          ]}
        />

        <H3>Sobre las subespecialidades</H3>
        <P>
          En &quot;Info General&quot; hay un campo para subespecialidades (una por linea). Son palabras clave de alto
          valor. Agrega todas:
        </P>
        <Example>
          Cirugia de cataratas<br />
          Tratamiento de glaucoma<br />
          Examen de la vista<br />
          Cirugia refractiva LASIK
        </Example>

        <H3>Sobre las FAQs &mdash; muy importante</H3>
        <P>
          Las FAQs generan automaticamente resultados expandibles en Google (debajo de tu enlace). Escribe preguntas
          que los pacientes realmente buscan:
        </P>

        <Compare
          good={{
            title: "Buenas FAQs",
            items: [
              '"Cuanto cuesta la cirugia de cataratas en Guadalajara?"',
              '"Cuanto dura la recuperacion?"',
              '"Se necesita anestesia general?"',
              '"Que incluye la consulta?"',
            ],
          }}
          bad={{
            title: "Malas FAQs",
            items: [
              '"Por que elegirme?"',
              '"Donde estudie?"',
              '"Acepto seguros?"',
              '"Cual es mi experiencia?"',
            ],
          }}
        />
      </Section>

      {/* Paso 2 */}
      <Section>
        <SectionNumber n={2} />
        <H2>Crea tu Google Business Profile</H2>
        <P>
          Google Business Profile (GBP) es tu <strong>tarjeta de negocio en Google Maps</strong>. Sin el, eres
          invisible en busquedas locales como &quot;oftalmologo cerca de mi&quot;.
        </P>
        <Alert variant="warning">
          <strong className="block mb-1">Es gratis.</strong>
          Google Business Profile no tiene ningun costo. Lo creas en 15 minutos.
        </Alert>

        <Step n={1}>
          Ve a{" "}
          <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            business.google.com
          </a>{" "}
          e inicia sesion con tu cuenta de Google (Gmail).
        </Step>
        <Step n={2}>
          <strong>Nombre del negocio:</strong> Escribe tu nombre EXACTAMENTE como aparece en tusalud.pro. Sin agregar
          especialidad ni ciudad.
        </Step>

        <Compare
          good={{ title: "Correcto", items: ["Dr. Jose Cruz Ruiz", "Dra. Patricia Roldan Mora"] }}
          bad={{
            title: "Incorrecto (riesgo de suspension)",
            items: ["Dr. Jose Cruz Ruiz - Oftalmologo GDL", "Dra. Patricia - Cirugia Bariatrica"],
          }}
        />

        <Step n={3}>
          <strong>Categoria:</strong> El factor #1 de ranking local. Elige la MAS ESPECIFICA:
          <Table
            headers={["Si eres...", "Categoria principal", "Secundarias"]}
            rows={[
              ["Oftalmologo", "Ophthalmologist", "Ophthalmology clinic, Eye care center"],
              ["Cirujano bariatrico", "General surgeon", "Medical clinic, Specialized clinic"],
              ["Cirujano general", "General surgeon", "Medical clinic"],
              ["Cardiologo", "Cardiologist", "Medical clinic"],
              ["Dermatologo", "Dermatologist", "Medical clinic"],
            ]}
          />
          <p className="text-xs text-gray-500 mt-1">
            Las categorias aparecen en ingles pero Google las traduce al espanol para los pacientes.
          </p>
        </Step>
        <Step n={4}>
          <strong>Direccion:</strong> La direccion EXACTA de tu consultorio, caracter por caracter igual que en
          tusalud.pro. Si en tusalud dice &quot;Av.&quot; no pongas &quot;Avenida&quot;.
        </Step>
        <Step n={5}>
          <strong>Telefono:</strong> El mismo numero que esta en tusalud.pro, con codigo de pais (+52).
        </Step>
        <Step n={6}>
          <strong>Sitio web:</strong> Tu pagina ESPECIFICA en tusalud.pro, NO la pagina principal.
        </Step>

        <Compare
          good={{
            title: "Correcto",
            items: ["https://tusalud.pro/doctores/dr-jose", "https://tusalud.pro/doctores/dra-patricia-roldan-mora"],
          }}
          bad={{ title: "Incorrecto", items: ["https://tusalud.pro", "https://tusalud.pro/doctores"] }}
        />

        <Step n={7}>
          <strong>Horario:</strong> El mismo horario exacto que configuraste en tusalud.pro para ese consultorio.
        </Step>
        <Step n={8}>
          <strong>Descripcion:</strong> 750 caracteres max. Escribe natural, sin repetir palabras clave.
        </Step>

        <Example>
          <strong>Ejemplo de buena descripcion:</strong>
          <br /><br />
          &quot;Soy el Dr. Jose Cruz Ruiz, oftalmologo en Guadalajara, Jalisco, con mas de 15 anos de experiencia.
          Ofrezco consultas de oftalmologia general, cirugia de cataratas, tratamiento de glaucoma, y examenes de la
          vista completos. Agenda tu cita en linea.&quot;
        </Example>

        <Alert variant="danger">
          <strong className="block mb-1">NUNCA hagas esto:</strong>
          &quot;Oftalmologo Guadalajara. Mejor oftalmologo en Guadalajara. Oftalmologo precio Guadalajara.&quot;
          &mdash; Esto es &quot;keyword stuffing&quot; y Google te penaliza.
        </Alert>

        <Step n={9}>
          <strong>Servicios:</strong> Agrega cada servicio que ofreces. Los nombres deben coincidir con tusalud.pro.
        </Step>
        <Step n={10}>
          <strong>Enlace de citas:</strong> Agrega tu enlace de reservas de tusalud.pro para que los pacientes agenden
          desde Google.
        </Step>
      </Section>

      {/* Paso 3 */}
      <Section>
        <SectionNumber n={3} />
        <H2>Verifica tu perfil</H2>
        <P>
          <strong>Tu perfil NO aparece en Google hasta que este verificado.</strong> Google necesita confirmar que tu
          consultorio es real.
        </P>
        <Table
          headers={["Metodo", "Como funciona", "Tiempo"]}
          rows={[
            [<strong key="a">Tarjeta postal</strong>, "Google envia una tarjeta con un PIN a tu consultorio", "5-14 dias"],
            [<strong key="b">Telefono</strong>, "Llamada o SMS automatico al telefono del negocio", "Inmediato"],
            [<strong key="c">Video</strong>, "Grabas un video mostrando el consultorio", "3-5 dias"],
            [<strong key="d">Videollamada</strong>, "Llamada en vivo con representante de Google", "Programada"],
          ]}
        />
        <Alert variant="info">
          <strong className="block mb-1">En Mexico, Google frecuentemente pide verificacion por video para doctores.</strong>
          Que filmar (menos de 5 min, con tu celular):
          <br /><br />
          1. Exterior del consultorio &mdash; que se vea la direccion<br />
          2. Recepcion &mdash; donde llegan los pacientes<br />
          3. Consultorio &mdash; la sala donde atiendes<br />
          4. Tu &mdash; aparece brevemente en el video<br />
          5. Algun identificador &mdash; placa profesional, credencial
        </Alert>
      </Section>

      {/* Paso 4 */}
      <Section>
        <SectionNumber n={4} />
        <H2>Sube fotos (las mismas que en tusalud.pro)</H2>
        <P>
          Perfiles con fotos reciben significativamente mas clics.{" "}
          <mark className="bg-yellow-100 px-1 rounded">Usa las MISMAS fotos en ambas plataformas</mark> &mdash;
          Google cruza imagenes y si ve las mismas fotos reales en ambos sitios, aumenta la confianza.
        </P>
        <Table
          headers={["Tipo de foto", "Que mostrar", "Cuantas"]}
          rows={[
            [<strong key="a">Tu retrato</strong>, "La MISMA foto que esta en tusalud.pro", "1"],
            [<strong key="b">Exterior</strong>, "Fachada del edificio, que se vea la direccion", "2-3"],
            [<strong key="c">Interior</strong>, "Recepcion, sala de espera, consultorio", "3-5"],
            [<strong key="d">Equipo medico</strong>, "Equipos que uses en consulta", "1-2"],
            [<strong key="e">Tu equipo</strong>, "Personal de trabajo (con su consentimiento)", "1-2"],
          ]}
        />
        <P><strong>Total minimo: 10 fotos.</strong> Agrega 2-3 nuevas cada mes.</P>
        <Alert variant="danger">
          <strong className="block mb-1">NO uses fotos de stock.</strong>
          Google las detecta. Usa solo fotos reales de tu consultorio.
        </Alert>
        <P>
          <strong>Requisitos tecnicos:</strong> JPG o PNG, entre 10 KB y 5 MB, minimo 250x250 px (recomendado
          720x720), sin filtros excesivos.
        </P>
      </Section>

      {/* Paso 5 */}
      <Section>
        <SectionNumber n={5} />
        <H2>Si tienes 2 consultorios</H2>
        <P>
          En tusalud.pro puedes tener hasta 2 ubicaciones. La regla de Google es:{" "}
          <strong>1 perfil de GBP por ubicacion.</strong>
        </P>
        <Table
          headers={["", "Consultorio Principal", "Consultorio 2"]}
          rows={[
            [<strong key="a">Perfil GBP</strong>, "Perfil #1", "Perfil #2 (separado)"],
            [<strong key="b">Nombre</strong>, "Dr. Jose Cruz Ruiz", "Dr. Jose Cruz Ruiz"],
            [<strong key="c">Direccion</strong>, "La de ese consultorio", "La del otro consultorio"],
            [<strong key="d">Horario</strong>, "Horario de ese consultorio", "Horario del otro"],
          ]}
        />
        <P>
          Cada perfil se verifica por separado. La informacion de cada consultorio en tusalud.pro debe coincidir con
          su perfil GBP correspondiente.
        </P>
      </Section>

      {/* Paso 6 */}
      <Section>
        <SectionNumber n={6} />
        <H2>Resenas: donde importan y por que necesitas las dos</H2>
        <P>
          Existen <strong>dos sistemas de resenas completamente independientes</strong>. Ambos son importantes pero
          para cosas distintas:
        </P>
        <Table
          headers={["", "Resenas en tusalud.pro", "Resenas en Google"]}
          rows={[
            [<strong key="a">Donde se ven</strong>, "En tu pagina de tusalud.pro", "En Google Maps y resultados de busqueda"],
            [
              <strong key="b">Que afectan</strong>,
              "Estrellas en resultados organicos (el enlace azul)",
              "Tu posicion en el mapa de Google (los 3 primeros resultados)",
            ],
            [<strong key="c">Necesitas las dos?</strong>, <strong key="c1">SI</strong>, <strong key="c2">SI</strong>],
          ]}
        />

        <H3>Como pedir resenas en Google (sin violar las reglas)</H3>
        <Compare
          good={{
            title: "Esto SI puedes hacer",
            items: [
              'Decir: "Si tuvo buena experiencia, nos ayudaria con una resena en Google"',
              "Dar una tarjeta con codigo QR",
              "Enviar SMS de seguimiento con el enlace",
              "Poner un letrero en la recepcion",
            ],
          }}
          bad={{
            title: "Esto NO puedes hacer",
            items: [
              "Ofrecer descuentos a cambio de resenas",
              "Decirle al paciente que escribir",
              "Solo pedir a pacientes contentos",
              "Pedir a familiares o empleados",
              "Escribir resenas sobre ti mismo",
            ],
          }}
        />

        <H3>Como obtener tu enlace de resenas</H3>
        <Step n={1}>En tu dashboard de GBP, busca &quot;Pedir resenas&quot; o &quot;Obtener mas resenas&quot;</Step>
        <Step n={2}>
          Google genera un enlace corto (ej: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">g.page/dr-jose/review</code>)
        </Step>
        <Step n={3}>Convierte ese enlace en un codigo QR e imprimelo en tarjetas para la recepcion</Step>

        <H3>Metas de resenas en Google</H3>
        <Table
          headers={["Resenas", "Efecto"]}
          rows={[
            ["0 - 5", "Google probablemente no muestra estrellas"],
            ["10+", "Empiezan a aparecer estrellas"],
            ["25+", "Competitivo para busquedas locales"],
            ["50+", "Autoridad fuerte en tu area"],
          ]}
        />
        <Alert variant="warning">
          <strong className="block mb-1">La velocidad importa mas que el total.</strong>
          5 resenas nuevas por mes es mejor que 50 resenas viejas sin ninguna nueva. Google premia la actividad
          constante.
        </Alert>

        <H3>Responde SIEMPRE</H3>
        <P>
          <strong>Positivas:</strong> Agradece por nombre, breve.{" "}
          <em>&quot;Gracias, Maria! Me alegra que su consulta haya sido buena.&quot;</em>
        </P>
        <P>
          <strong>Negativas:</strong> NUNCA discutas.{" "}
          <em>&quot;Lamentamos su experiencia. Contactenos al [tel] para resolverlo.&quot;</em>
        </P>
        <P>
          Responde en menos de 48 horas. <strong>NUNCA reveles informacion de salud del paciente.</strong>
        </P>
      </Section>

      {/* Paso 7 */}
      <Section>
        <SectionNumber n={7} />
        <H2>Blog y Google Posts: son cosas diferentes</H2>
        <P>Muchos doctores se confunden con esto. Son dos herramientas distintas con propositos distintos:</P>
        <Table
          headers={["", "Blog en tusalud.pro", "Google Posts (en GBP)"]}
          rows={[
            [<strong key="a">Que es</strong>, "Articulos completos en tu pagina", "Publicaciones cortas en tu perfil de Google"],
            [<strong key="b">Duracion</strong>, "Permanente", "Expiran en 6 meses"],
            [
              <strong key="c">Impacto en Google</strong>,
              "ALTO — cada articulo puede aparecer como resultado independiente",
              "BAJO — solo muestra que tu perfil esta activo",
            ],
            [
              <strong key="d">Ejemplo</strong>,
              'Articulo de 800 palabras: "Que es el glaucoma"',
              'Post corto: "Sabias que el glaucoma es la 2da causa de ceguera?"',
            ],
          ]}
        />

        <Alert variant="success">
          <strong className="block mb-1">La estrategia correcta: AMBOS</strong>
          1. Escribe el articulo completo en tu blog de tusalud.pro<br />
          2. Crea un Google Post corto sobre el mismo tema con un enlace al articulo
        </Alert>

        <H3>Temas que funcionan para el blog</H3>
        <Table
          headers={["Patron", "Ejemplo"]}
          rows={[
            ['"Que es [condicion]"', '"Que es el glaucoma y como se detecta"'],
            ['"[Procedimiento] en [ciudad]"', '"Cirugia de cataratas en Guadalajara: guia completa"'],
            ['"Precio de [especialidad]"', '"Cuanto cuesta una consulta de oftalmologia en Guadalajara"'],
            ['"Sintomas de [condicion]"', '"5 sintomas de cataratas que no debes ignorar"'],
          ]}
        />

        <H3>Reglas para escribir articulos medicos que Google posicione</H3>
        <Step n={1}>
          <strong>Escribe desde tu experiencia:</strong> &quot;En mi consulta, los pacientes me preguntan
          frecuentemente...&quot;
        </Step>
        <Step n={2}>
          <strong>Responde la pregunta en el primer parrafo.</strong> Si el titulo es &quot;Cuanto cuesta la
          cirugia?&quot;, la primera oracion debe dar el precio.
        </Step>
        <Step n={3}>
          <strong>Cita fuentes medicas:</strong> &quot;Segun la Academia Americana de Oftalmologia...&quot;
        </Step>
        <Step n={4}>
          <strong>Agrega un disclaimer:</strong> &quot;Esta informacion es educativa y no sustituye una consulta
          medica.&quot;
        </Step>
        <Step n={5}>
          <strong>Enlaza a tu perfil al final:</strong> &quot;Si necesitas [servicio], agenda tu cita conmigo.&quot;
        </Step>
      </Section>

      {/* Paso 8 */}
      <Section>
        <SectionNumber n={8} />
        <H2>Google Posts &mdash; publicaciones semanales</H2>
        <P>
          Publica 1-2 veces por semana directamente en tu Google Business Profile. Son publicaciones cortas con foto y
          un boton de accion.
        </P>
        <Step n={1}>
          Ve a{" "}
          <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            business.google.com
          </a>{" "}
          y selecciona tu perfil
        </Step>
        <Step n={2}>Haz clic en &quot;Agregar actualizacion&quot;</Step>
        <Step n={3}>
          Escribe un texto corto (150-300 palabras), agrega una foto, y un boton (&quot;Reservar&quot;, &quot;Mas
          info&quot; o &quot;Llamar&quot;)
        </Step>

        <H3>Ideas para posts semanales</H3>
        <Table
          headers={["Semana", "Tipo de post"]}
          rows={[
            ["Semana 1", "Tip de salud relacionado a tu especialidad"],
            ["Semana 2", "Promocion de un articulo del blog (con enlace)"],
            ["Semana 3", "Novedad del consultorio"],
            ["Semana 4", "Consejo estacional (proteccion solar, alergias, etc.)"],
          ]}
        />
      </Section>

      {/* Tabla critica */}
      <Section>
        <H2 className="text-red-700">Tabla critica: Datos que DEBEN ser identicos</H2>
        <P>
          Esta es la tabla mas importante de esta guia. Google cruza esta informacion entre plataformas. Si no
          coincide, pierde confianza en tu perfil.
        </P>
        <Table
          headers={["Dato", "En tusalud.pro", "En Google Business Profile"]}
          rows={[
            [<strong key="a">Nombre</strong>, "Info General → Nombre", "Nombre del negocio"],
            [<strong key="b">Direccion</strong>, "Clinica → Consultorio → Direccion", "Direccion"],
            [<strong key="c">Telefono</strong>, "Clinica → Consultorio → Telefono", "Telefono"],
            [<strong key="d">Horario</strong>, "Clinica → Consultorio → Horario", "Horario"],
            [<strong key="e">Servicios</strong>, "Tab Servicios → Nombre + Descripcion", "Servicios en GBP"],
            [<strong key="f">Foto de perfil</strong>, "Info General → Foto hero", "Foto de perfil / Logo"],
            [<strong key="g">Fotos del consultorio</strong>, "Multimedia → Carrusel", "Fotos en GBP"],
            [<strong key="h">Sitio web</strong>, "(automatico)", "tusalud.pro/doctores/tu-slug"],
            [<strong key="i">Coordenadas</strong>, "Clinica → Latitud / Longitud", "Pin en Google Maps"],
          ]}
        />
        <Alert variant="danger">
          <strong className="block mb-1">IDENTICA significa identica.</strong>
          Si en tusalud.pro dice &quot;Av. Patria 1234&quot;, en Google DEBE decir &quot;Av. Patria 1234&quot;
          &mdash; no &quot;Avenida Patria 1234&quot;, no &quot;Av Patria 1234&quot;. Caracter por caracter.
        </Alert>
      </Section>

      {/* Plan de accion */}
      <Section>
        <H2>Tu plan de accion</H2>

        <H3>Semana 1</H3>
        <Checklist
          items={[
            "Completa tu perfil al 100% en tusalud.pro (todas las tabs)",
            "Sube minimo 5 fotos reales a tu carrusel",
            "Escribe minimo 8 FAQs",
            "Crea tu Google Business Profile",
            "Si tienes 2 consultorios, crea 2 perfiles",
            "Inicia la verificacion",
          ]}
        />

        <H3>Semana 2</H3>
        <Checklist
          items={[
            "Completa la verificacion de GBP",
            "Sube las MISMAS fotos a GBP (minimo 10)",
            "Agrega todos tus servicios a GBP",
            "Genera tu enlace de resenas y crea un QR",
            "Coloca el QR en la recepcion",
            "Capacita a tu equipo para pedir resenas",
          ]}
        />

        <H3>Cada semana</H3>
        <Checklist
          items={[
            "Pide a 1-2 pacientes que dejen resena en Google",
            "Responde a TODAS las resenas en menos de 48 horas",
            "Publica 1 Google Post",
            "Escribe 1 articulo de blog cada 1-2 semanas",
          ]}
        />

        <H3>Cada mes</H3>
        <Checklist
          items={[
            "Sube 2-3 fotos nuevas a GBP",
            "Actualiza horarios si hay cambios",
            "Verifica que direccion y telefono siguen identicos",
            "Meta: 5+ resenas nuevas en Google",
          ]}
        />
      </Section>

      {/* Timeline */}
      <Section>
        <H2>Cuando empezare a ver resultados?</H2>
        <Table
          headers={["Tiempo", "Que esperar"]}
          rows={[
            [
              <strong key="a">30-60 dias</strong>,
              "Tu perfil aparece en Google Maps. Primeras resenas. Primeras visitas desde GBP.",
            ],
            [
              <strong key="b">90-120 dias</strong>,
              "Mejoras visibles en ranking organico. Blog posts empiezan a aparecer en Google.",
            ],
            [
              <strong key="c">4-8 meses</strong>,
              'Competitivo para busquedas como "oftalmologo en guadalajara". Autoridad establecida.',
            ],
          ]}
        />
        <p className="text-sm text-gray-500 mt-3">
          El SEO medico no es inmediato. Es una inversion que se acumula con el tiempo. La constancia es mas
          importante que la intensidad.
        </p>
      </Section>

      {/* FAQ */}
      <Section>
        <H2>Preguntas frecuentes</H2>
        {[
          { q: '"Necesito pagar algo?"', a: "No. Google Business Profile es completamente gratis." },
          {
            q: '"Puedo pedirle a mis familiares que me dejen resenas?"',
            a: "NO. Google detecta resenas de familiares y empleados, las elimina, y puede suspender tu perfil.",
          },
          {
            q: '"Tengo que hacer todo esto yo?"',
            a: "Tu equipo de recepcion puede pedir resenas y responderlas. Los articulos del blog deben ser escritos o aprobados por ti (llevan tu nombre). El GBP lo puede manejar quien tenga acceso a la cuenta de Google.",
          },
          {
            q: '"Que hago con una resena falsa o injusta?"',
            a: 'Responde profesionalmente y ofrece resolver en privado. Si es claramente falsa, reportala a Google como "inapropiada". Google la revisara.',
          },
          {
            q: '"Puedo usar las mismas fotos en ambos lados?"',
            a: "SI. De hecho, DEBES hacerlo. Google cruza imagenes — fotos identicas en ambas plataformas aumentan la confianza.",
          },
          {
            q: '"Y si cambio de consultorio o de horario?"',
            a: "Actualiza INMEDIATAMENTE en ambas plataformas. Informacion desactualizada dana tu ranking.",
          },
        ].map((faq, i) => (
          <div key={i} className="py-4 border-b border-gray-100 last:border-b-0">
            <p className="font-semibold text-[#0f4c75] mb-1">{faq.q}</p>
            <p className="text-gray-600">{faq.a}</p>
          </div>
        ))}
      </Section>

      {/* Footer */}
      <div className="text-center py-10 text-gray-400 text-sm">
        <p>Documento preparado por el equipo de tusalud.pro &mdash; Abril 2026</p>
        <p>Si tienes dudas, contacta a tu administrador de cuenta.</p>
      </div>
    </div>
  );
}

/* ─── Reusable sub-components ─────────────────────────────────────────────── */

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
      {children}
    </div>
  );
}

function SectionNumber({ n }: { n: number }) {
  return (
    <div className="w-9 h-9 rounded-full bg-[#0f4c75] text-white flex items-center justify-center font-bold text-sm mb-3">
      {n}
    </div>
  );
}

function H2({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-xl sm:text-2xl font-bold text-[#0f4c75] mb-4 leading-tight ${className || ""}`}>
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-900 mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-700 leading-relaxed mb-3">{children}</p>;
}

function Alert({ variant, children }: { variant: "info" | "warning" | "danger" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-50 border-l-4 border-blue-500 text-blue-900",
    warning: "bg-orange-50 border-l-4 border-orange-500 text-orange-900",
    danger: "bg-red-50 border-l-4 border-red-500 text-red-900",
    success: "bg-green-50 border-l-4 border-green-500 text-green-900",
  };
  return <div className={`rounded-lg p-4 my-4 text-sm ${styles[variant]}`}>{children}</div>;
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-3 text-sm text-gray-600">
      {children}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <div className="shrink-0 w-7 h-7 rounded-full bg-blue-50 text-[#0f4c75] flex items-center justify-center font-bold text-xs mt-0.5">
        {n}
      </div>
      <div className="flex-1 text-sm text-gray-700">{children}</div>
    </div>
  );
}

function Compare({
  good,
  bad,
}: {
  good: { title: string; items: string[] };
  bad: { title: string; items: string[] };
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
        <h4 className="font-semibold text-green-800 mb-2">{good.title}</h4>
        {good.items.map((item, i) => (
          <div key={i}>&bull; {item}</div>
        ))}
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
        <h4 className="font-semibold text-red-800 mb-2">{bad.title}</h4>
        {bad.items.map((item, i) => (
          <div key={i}>&bull; {item}</div>
        ))}
      </div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="bg-gray-50 px-3 py-2.5 text-left font-semibold text-[#0f4c75] border-b-2 border-gray-200">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 border-b border-gray-100 text-gray-700 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="my-3 space-y-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
          <div className="shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-gray-300 bg-white" />
          <span className="text-sm text-gray-700">{item}</span>
        </li>
      ))}
    </ul>
  );
}
