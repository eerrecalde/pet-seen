export const resources = {
  'en-GB': {
    translation: {
      language: { label: 'Language', english: 'English', spanish: 'Español (LatAm)' },
      common: {
        petSeenHome: 'Pet Seen home',
        backToHome: 'Back to home',
        backToCases: 'All Pet Seen cases',
        nearbyPets: 'Nearby pets',
        signIn: 'Sign in', account: 'My account',
        continue: 'Continue',
        submitSighting: 'Submit sighting',
        goHome: 'Go home',
        dog: 'Dog', cat: 'Cat', young: 'Young', adult: 'Adult', senior: 'Senior',
      },
      home: {
        eyebrow: 'Helping pets get home', title: 'What happened?',
        intro: 'Start with the option that best fits. You can report a sighting without an account.',
        missingLabel: 'My pet is missing', missingDescription: 'Create a missing-pet case and share it with people nearby.',
        sightingLabel: 'I saw a pet', sightingDescription: 'A photo, place and time could help someone bring a pet home.',
        foundLabel: 'I found a pet', foundDescription: 'Tell the community about a pet that is safe with you.',
        howItWorks: 'How Pet Seen works', howItWorksTitle: 'Clear reports for people nearby.',
        essentialsTitle: 'Share the essentials.', essentialsBody: 'Add a photo, the last place the pet was seen and a helpful description.',
        privacyTitle: 'Keep exact locations private.', privacyBody: 'Public maps show a broader area, while the owner sees precise sighting details.',
        neighboursTitle: 'Give neighbours one route to help.', neighboursBody: 'Every public case has a simple sighting form.',
      },
      missingCase: {
        progress: 'Missing-pet case', step: 'Step {{current}} of {{total}}', eyebrow: 'Start a case', title: 'Tell us about your pet.',
        intro: 'We’ll help you create a shareable page. You can review everything before it goes public.', details: 'Pet details',
        petName: 'Pet’s name', markings: 'Colour or markings', markingsHint: 'For example, black with white chest', age: 'Age', selectAge: 'Select age',
        photo: 'Photo', addPhoto: 'Add a clear photo', photoHint: 'JPG or PNG, up to 10 MB',
        lastSeenQuestion: 'When and where was {{petName}} last seen?', lastSeen: 'Last seen', location: 'Location',
        exactLocationNote: 'This exact location is only visible to you and Pet Seen administrators.',
      },
      publicCase: {
        imageDescription: 'Illustration of {{petName}}, a black dog with a white chest', status: 'Missing', title: '{{petName}} is missing.',
        lead: 'A black-and-white dog missing from Victoria Park, Hackney.', lastSeen: 'Last seen', lastSeenValue: 'Today at around 4:30 pm',
        area: 'Area', areaValue: 'Victoria Park area', action: 'I saw {{petName}}', privacy: 'Your report can include the exact place. It is shared only with {{petName}}’s owner and Pet Seen administrators.',
        about: 'About {{petName}}', descriptionTitle: 'Black coat with a white chest.', description: '{{petName}} is a friendly medium-sized dog. He was wearing a faded red collar. Please do not chase him; report where and when you saw him instead.',
        mapNote: 'This map shows an approximate area to protect {{petName}}’s privacy.',
      },
      sighting: {
        progress: 'Report a sighting', eyebrow: 'No account needed', title: 'Tell us what you saw.',
        intro: 'A clear report gives an owner useful information without sharing your contact details publicly.',
        petQuestion: 'Do you know which pet this might be?', petOrCase: 'Pet or case', knownPet: 'Milo — Victoria Park area', unknownPet: 'I’m not sure / a different pet', petHelp: 'You can submit a sighting even if you do not know the pet.',
        whenWhere: 'Where and when?', where: 'Where did you see the pet?', whereHint: 'Street, park or landmark', when: 'When did you see them?', whenHint: 'For example, today at 5:15 pm',
        detailsQuestion: 'What did you notice?', details: 'Details', detailsHint: 'Colour, collar, direction of travel or anything else that may help.',
        addPhoto: 'Add a photo', photoHint: 'Optional, but helpful if it is safe to take one.', privacy: 'Your exact location is not shown on the public case page.',
      },
      auth: {
        eyebrow: 'Account access', title: 'Sign in with your email.', accountTitle: 'Your account', intro: 'We’ll email you a secure link. No password is needed.', emailLabel: 'Email address', emailHint: 'you@example.com', sendLink: 'Email me a sign-in link', sentTitle: 'Check your email.', sentBody: 'We sent a secure sign-in link to {{email}}.', toast: 'You’re signed in.', privacy: 'We use your email only to secure your account and contact you about your cases.', setupNote: 'Authentication needs local environment settings before you can send a sign-in link.', notConfigured: 'Authentication is not configured in this environment.', loading: 'Checking your sign-in status…', signedInTitle: 'You’re signed in.', signedInBody: 'Your account is using {{email}}.', signOut: 'Sign out',
      },
      placeholders: {
        laterRelease: 'Later release', foundTitle: 'Found-pet reports are coming next.', foundBody: 'For now, please use a sighting report to share where you saw a pet.',
        accountAccess: 'Account access', authTitle: 'Sign in will use a secure email link.', authBody: 'You will not need a password. This is being built with the missing-pet case flow.',
        notFound: 'Not found', notFoundTitle: 'This page is not here yet.',
      },
      footer: 'Helping pets get home, together.',
    },
  },
  'es-419': {
    translation: {
      language: { label: 'Idioma', english: 'Inglés', spanish: 'Español (LatAm)' },
      common: {
        petSeenHome: 'Inicio de Pet Seen', backToHome: 'Volver al inicio', backToCases: 'Todos los casos de Pet Seen', nearbyPets: 'Mascotas cerca', signIn: 'Iniciar sesión', account: 'Mi cuenta', continue: 'Continuar', submitSighting: 'Enviar avistamiento', goHome: 'Ir al inicio', dog: 'Perro', cat: 'Gato', young: 'Joven', adult: 'Adulto', senior: 'Mayor',
      },
      home: {
        eyebrow: 'Ayudamos a que las mascotas vuelvan a casa', title: '¿Qué pasó?', intro: 'Elige la opción que mejor describa la situación. Puedes reportar un avistamiento sin crear una cuenta.',
        missingLabel: 'Mi mascota está perdida', missingDescription: 'Crea un caso de mascota perdida y compártelo con personas cerca.',
        sightingLabel: 'Vi una mascota', sightingDescription: 'Una foto, el lugar y la hora pueden ayudar a que una mascota vuelva a casa.',
        foundLabel: 'Encontré una mascota', foundDescription: 'Cuéntale a la comunidad que tienes a salvo una mascota.',
        howItWorks: 'Cómo funciona Pet Seen', howItWorksTitle: 'Reportes claros para las personas cerca.',
        essentialsTitle: 'Comparte lo esencial.', essentialsBody: 'Agrega una foto, el último lugar donde se vio a la mascota y una descripción útil.',
        privacyTitle: 'Mantén privados los lugares exactos.', privacyBody: 'Los mapas públicos muestran un área más amplia, mientras que la persona dueña ve los detalles precisos.',
        neighboursTitle: 'Dale a tus vecinos una forma de ayudar.', neighboursBody: 'Cada caso público tiene un formulario sencillo para reportar avistamientos.',
      },
      missingCase: {
        progress: 'Caso de mascota perdida', step: 'Paso {{current}} de {{total}}', eyebrow: 'Inicia un caso', title: 'Cuéntanos sobre tu mascota.', intro: 'Te ayudaremos a crear una página para compartir. Podrás revisar todo antes de que se publique.', details: 'Datos de la mascota',
        petName: 'Nombre de la mascota', markings: 'Color o marcas', markingsHint: 'Por ejemplo, negro con el pecho blanco', age: 'Edad', selectAge: 'Selecciona la edad',
        photo: 'Foto', addPhoto: 'Agrega una foto clara', photoHint: 'JPG o PNG, hasta 10 MB', lastSeenQuestion: '¿Cuándo y dónde se vio por última vez a {{petName}}?', lastSeen: 'Última vez visto', location: 'Lugar', exactLocationNote: 'Este lugar exacto solo será visible para ti y las personas administradoras de Pet Seen.',
      },
      publicCase: {
        imageDescription: 'Ilustración de {{petName}}, un perro negro con el pecho blanco', status: 'Perdido', title: '{{petName}} está perdido.', lead: 'Un perro blanco y negro perdido en Victoria Park, Hackney.', lastSeen: 'Última vez visto', lastSeenValue: 'Hoy alrededor de las 4:30 p. m.', area: 'Área', areaValue: 'Zona de Victoria Park', action: 'Vi a {{petName}}', privacy: 'Tu reporte puede incluir el lugar exacto. Solo se comparte con la persona dueña de {{petName}} y las personas administradoras de Pet Seen.', about: 'Sobre {{petName}}', descriptionTitle: 'Pelaje negro con el pecho blanco.', description: '{{petName}} es un perro mediano y amigable. Llevaba un collar rojo desgastado. Por favor, no lo persigas; mejor reporta dónde y cuándo lo viste.', mapNote: 'Este mapa muestra un área aproximada para proteger la privacidad de {{petName}}.',
      },
      sighting: {
        progress: 'Reportar un avistamiento', eyebrow: 'No necesitas una cuenta', title: 'Cuéntanos qué viste.', intro: 'Un reporte claro le da a la persona dueña información útil sin mostrar públicamente tus datos de contacto.', petQuestion: '¿Sabes qué mascota podría ser?', petOrCase: 'Mascota o caso', knownPet: 'Milo — zona de Victoria Park', unknownPet: 'No estoy seguro/a / es otra mascota', petHelp: 'Puedes enviar un avistamiento aunque no sepas qué mascota es.', whenWhere: '¿Dónde y cuándo?', where: '¿Dónde viste a la mascota?', whereHint: 'Calle, parque o punto de referencia', when: '¿Cuándo la viste?', whenHint: 'Por ejemplo, hoy a las 5:15 p. m.', detailsQuestion: '¿Qué notaste?', details: 'Detalles', detailsHint: 'Color, collar, dirección en la que iba o cualquier otro dato que pueda ayudar.', addPhoto: 'Agrega una foto', photoHint: 'Es opcional, pero ayuda si puedes tomarla sin riesgo.', privacy: 'Tu ubicación exacta no aparece en la página pública del caso.',
      },
      auth: {
        eyebrow: 'Acceso a la cuenta', title: 'Inicia sesión con tu correo electrónico.', accountTitle: 'Tu cuenta', intro: 'Te enviaremos un enlace seguro. No necesitas contraseña.', emailLabel: 'Correo electrónico', emailHint: 'tu@ejemplo.com', sendLink: 'Enviarme un enlace para iniciar sesión', sentTitle: 'Revisa tu correo electrónico.', sentBody: 'Enviamos un enlace seguro a {{email}}.', toast: 'Has iniciado sesión.', privacy: 'Usamos tu correo electrónico solo para proteger tu cuenta y contactarte sobre tus casos.', setupNote: 'La autenticación necesita ajustes del entorno local antes de que puedas enviar un enlace.', notConfigured: 'La autenticación no está configurada en este entorno.', loading: 'Revisando tu estado de inicio de sesión…', signedInTitle: 'Has iniciado sesión.', signedInBody: 'Tu cuenta usa {{email}}.', signOut: 'Cerrar sesión',
      },
      placeholders: {
        laterRelease: 'Próxima versión', foundTitle: 'Los reportes de mascotas encontradas llegarán pronto.', foundBody: 'Por ahora, usa un reporte de avistamiento para compartir dónde viste a una mascota.', accountAccess: 'Acceso a la cuenta', authTitle: 'El inicio de sesión usará un enlace seguro por correo electrónico.', authBody: 'No necesitarás una contraseña. Estamos creando esta función junto con el flujo de mascotas perdidas.', notFound: 'No encontrado', notFoundTitle: 'Esta página todavía no existe.',
      },
      footer: 'Ayudamos a que las mascotas vuelvan a casa, juntos.',
    },
  },
} as const

export type AppLocale = keyof typeof resources
