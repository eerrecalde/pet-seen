export const resources = {
  'en-GB': {
    translation: {
      language: {
        label: 'Language',
        english: 'English',
        spanish: 'Español (LatAm)',
      },
      common: {
        petSeenHome: 'Pet Seen home',
        backToHome: 'Back to home',
        backToCases: 'All Pet Seen cases',
        nearbyPets: 'Nearby pets',
        signIn: 'Sign in',
        account: 'My account',
        continue: 'Continue',
        submitSighting: 'Submit sighting',
        yes: 'Yes',
        no: 'No',
        goHome: 'Go home',
        skipToContent: 'Skip to main content',
        dog: 'Dog',
        cat: 'Cat',
        young: 'Young',
        adult: 'Adult',
        senior: 'Senior',
      },
      home: {
        eyebrow: 'Helping pets get home',
        title: 'What happened?',
        intro:
          'Start with the option that best fits. You can report a sighting without an account.',
        missingLabel: 'My pet is missing',
        missingDescription:
          'Create a missing-pet case and share it with people nearby.',
        sightingLabel: 'I saw a pet',
        sightingDescription:
          'A photo, place and time could help someone bring a pet home.',
        foundLabel: 'I found a pet',
        foundDescription:
          'Record the details and where you found a pet that may be safe with you.',
        howItWorks: 'How Pet Seen works',
        howItWorksTitle: 'Clear reports for people nearby.',
        essentialsTitle: 'Share the essentials.',
        essentialsBody:
          'Add a photo, the last place the pet was seen and a helpful description.',
        privacyTitle: 'Keep exact locations private.',
        privacyBody:
          'Public maps show a broader area, while the owner sees precise sighting details.',
        neighboursTitle: 'Give neighbours one route to help.',
        neighboursBody: 'Every public case has a simple sighting form.',
      },
      nearby: {
        eyebrow: 'Nearby',
        title: 'Missing pets in the area',
        intro:
          'Browse active cases first, then switch to the map for a broader view.',
        showMap: 'Show map',
        showList: 'Show list',
        loading: 'Loading nearby cases…',
        unavailable: 'Nearby discovery is unavailable right now.',
        empty: 'There are no active missing-pet cases nearby yet.',
        missingLabel: 'Missing pet',
        missingLegend: 'Missing-pet case',
        sightingLegend: 'Confirmed, approximate sighting',
        casePin: '{{petName}}’s approximate missing area',
        sightingPin: 'Approximate confirmed sighting',
        mapLabel:
          'Map of approximate missing-pet areas and confirmed sightings',
      },
      missingCase: {
        progress: 'Missing-pet case',
        step: 'Step {{current}} of {{total}}',
        eyebrow: 'Start a case',
        title: 'Tell us about your pet.',
        intro:
          'We’ll help you create a shareable page. You can review everything before it goes public.',
        details: 'Pet details',
        petName: 'Pet’s name',
        species: 'Species',
        breed: 'Breed',
        breedHint: 'For example, border collie',
        markings: 'Colour or markings',
        markingsHint: 'For example, black with white chest',
        description: 'Helpful details',
        descriptionHint:
          'Collar, temperament or anything that may help people recognise your pet.',
        photo: 'Photo',
        addPhoto: 'Add a clear photo',
        photoHint:
          'JPG or PNG, up to 10 MB. We remove photo metadata before sharing.',
        invalidPhoto: 'Choose a JPG or PNG image no larger than 10 MB.',
        preparePhotoError:
          'We could not prepare that photo. Try a different JPG or PNG image.',
        photoProcessError:
          'We could not process that photo. Please choose a different JPG or PNG image.',
        saving: 'Saving pet details…',
        saveError: 'We could not save your pet details. Please try again.',
        signInTitle: 'Sign in to start a case.',
        signInBody:
          'Missing-pet cases are linked to an account so you can manage them safely.',
        savedTitle: 'Pet details saved.',
        savedBody:
          'Your pet is ready for the next step: adding where they were last seen.',
        lastSeenQuestion: 'When and where was {{petName}} last seen?',
        lastSeen: 'Last seen',
        location: 'Location',
        exactLocationNote:
          'This exact location is only visible to you and Pet Seen administrators.',
      },
      publicCase: {
        imageDescription:
          'Illustration of {{petName}}, a black dog with a white chest',
        status: 'Missing',
        title: '{{petName}} is missing.',
        lead: 'A black-and-white dog missing from Victoria Park, Hackney.',
        leadForPet:
          '{{petName}} is missing. Please share a sighting if you can help.',
        lastSeen: 'Last seen',
        lastSeenValue: 'Today at around 4:30 pm',
        lastSeenUnknown: 'Time not provided',
        area: 'Area',
        areaValue: 'Victoria Park area',
        approximateArea: 'Approximate area',
        action: 'I saw {{petName}}',
        privacy:
          'Your report can include the exact place. It is shared only with {{petName}}’s owner and Pet Seen administrators.',
        about: 'About {{petName}}',
        descriptionTitle: 'More information',
        description:
          '{{petName}} is a friendly medium-sized dog. He was wearing a faded red collar. Please do not chase him; report where and when you saw him instead.',
        mapNote:
          'This 100 m-wide search area includes where {{petName}} was last seen. The exact location is not shown.',
        mapLabel: 'Approximate 100 metre search area for {{petName}}',
        loadingTitle: 'Loading this case',
        loadingBody: 'Please wait while we get the public case details.',
        notFoundTitle: 'This case is no longer available.',
        notFoundBody: 'It may have been closed or the link may be incorrect.',
        unavailableTitle: 'This public case is unavailable.',
        unavailableBody: 'Please try again shortly.',
        shareEyebrow: 'Help get the word out',
        shareTitle: 'Share this case',
        shareIntro:
          'Send the public case page to people nearby. It shows only an approximate area.',
        shareText:
          'Have you seen {{petName}}? Please check this Pet Seen case.',
        copyLink: 'Copy link',
        copied: 'Link copied.',
        copyError:
          'We could not copy the link. Please copy it from the address bar.',
        share: 'Share',
        shared: 'Thanks for sharing.',
        shareError: 'We could not open sharing. Try copying the link instead.',
        whatsApp: 'WhatsApp',
        poster: 'Print poster',
        print: 'Print poster',
        posterLabel: 'Missing-pet poster for {{petName}}',
        posterAlert: 'Missing pet',
        qrAlt: 'QR code linking to {{petName}}’s public Pet Seen case',
        qrTitle: 'Seen this pet?',
        qrBody: 'Scan the code or visit this link to report a sighting.',
      },
      contentReport: {
        trigger: 'Report this case',
        title: 'Report a problem with this case.',
        intro:
          'Tell us what looks wrong. Your report is reviewed by Pet Seen staff.',
        reason: 'Reason',
        details: 'More detail (optional)',
        submit: 'Send report',
        sending: 'Sending…',
        error: 'We could not send your report. Please try again.',
        thanksTitle: 'Report received.',
        thanksBody: 'Thank you. Pet Seen staff will review it.',
        reasons: {
          incorrect: 'Incorrect or outdated information',
          harmful: 'Harmful or unsafe content',
          scam: 'Possible scam or impersonation',
          other: 'Something else',
        },
      },
      moderation: {
        eyebrow: 'Staff area',
        title: 'Report review',
        intro: 'Review found-pet matches and reports from public case pages.',
        checking: 'Checking staff access…',
        deniedTitle: 'This area is for Pet Seen staff.',
        deniedBody:
          'Sign in with an authorised staff account to review reports.',
        loading: 'Loading reports…',
        error: 'We could not load the moderation queue. Please try again.',
        emptyTitle: 'No reports need review.',
        emptyBody: 'New reports from public case pages will appear here.',
        unavailableCase: 'Unavailable case',
        viewCase: 'View public case',
        statusLabel: 'Report status',
        status: {
          open: 'Open',
          reviewed: 'Reviewed',
          dismissed: 'Dismissed',
          actioned: 'Actioned',
        },
        foundMatches: 'Found-pet matches',
        foundMatchesIntro:
          'Every found-pet report stays private until a staff member reviews its text and any photo. Only approved reports can be matched or shared with an owner.',
        noFoundReports: 'No found-pet reports need matching.',
        noFoundReportsBody: 'New private found-pet reports will appear here.',
        foundPet: 'Found pet',
        custody: 'Current custody',
        foundLocation: 'Found near',
        findMatches: 'Find matches',
        findingMatches: 'Finding matches…',
        noCandidates: 'No active cases matched these checks.',
        linkedTo: 'Linked to {{petName}}',
        case: 'case',
        linkCase: 'Link case',
        linking: 'Linking…',
        lastSeenUnknown: 'Last-seen time unavailable',
        contentReports: 'Content reports',
        moderationPending: 'Awaiting review',
        moderationApproved: 'Approved',
        moderationRejected: 'Rejected',
        automatedFlag: 'Automated check: {{note}}',
        approve: 'Approve report',
        reject: 'Reject and delete files',
        reviewing: 'Saving decision…',
        photo: 'Submitted photo',
        photoUnavailable: 'The submitted photo is unavailable.',
        activeQueue: 'Active found-pet reports',
        closedQueue: 'Resolved or expired reports ({{count}})',
        lifecycle: {
          active: 'Active',
          resolved: 'Resolved',
          expired: 'Expired',
        },
        lifecycleReason: 'Lifecycle reason: {{reason}}',
        lifecycleReasonLabel: 'Reason',
        reason: {
          resolved: 'Resolved safely',
          duplicate: 'Duplicate report',
          test: 'Test report',
          stale: 'Stale report',
          other: 'Other',
        },
        resolve: 'Resolve',
        expire: 'Expire',
        reopen: 'Reopen report',
        deleteReport: 'Delete report',
        savingLifecycle: 'Saving…',
        runHousekeeping: 'Run housekeeping',
        runningHousekeeping: 'Running housekeeping…',
        housekeepingError: 'Housekeeping could not complete. Please try again.',
      },
      dashboard: {
        eyebrow: 'Your cases',
        title: 'Manage your missing-pet cases.',
        intro:
          'Keep the details current, then close the case when it no longer needs to be shared.',
        newCase: 'Start a new case',
        loading: 'Loading your cases…',
        loadError: 'We could not load your cases. Please try again.',
        signInTitle: 'Sign in to manage your cases.',
        signInBody:
          'Your cases are linked to your account so only you can update them.',
        emptyTitle: 'You have no missing-pet cases yet.',
        emptyBody: 'Start a case when you need help from people nearby.',
        viewPublic: 'View public page',
        pet: 'Pet',
        caseTitle: 'Case title',
        petName: 'Pet’s name',
        breed: 'Breed',
        colour: 'Colour or markings',
        description: 'Helpful details',
        lastSeenPlace: 'Last seen place or landmark',
        lastSeenTime: 'Last seen time',
        locationNote: 'Exact locations are never shown publicly.',
        saveChanges: 'Save changes',
        saving: 'Saving…',
        saved: 'Your changes have been saved.',
        saveError: 'We could not save those changes. Please try again.',
        statusError: 'We could not update this case. Please try again.',
        statusSaved: 'Case status updated.',
        edit: 'Edit details',
        changeStatus: 'Case status',
        reunitedNote: 'Marked as reunited. This case is no longer public.',
        closedNote: 'This case is closed and no longer public.',
        cancel: 'Cancel',
        sightings: 'Sighting reports',
        sightingTimeline: 'Exact sighting locations',
        sightingPrivacy:
          'These locations are private to you and Pet Seen staff.',
        coordinates: 'Exact map location',
        sightingStatusError:
          'We could not update this sighting. Please try again.',
        sightingStatusSaved: 'Sighting status updated.',
        markReunited: 'Mark reunited',
        reunionTitle: 'Tell us about the reunion.',
        reunionIntro: 'This helps Pet Seen understand what made a difference.',
        reunionReason: 'How was your pet reunited?',
        reunionReasons: {
          returned_home: 'They returned home',
          found_by_neighbour: 'A neighbour found them',
          seen_after_report: 'A sighting helped us find them',
          other: 'Another way',
        },
        petSeenHelped: 'Did Pet Seen help with the reunion?',
        confirmReunion: 'Confirm reunion',
        sightingStatus: {
          pending: 'Pending review',
          confirmed: 'Confirmed',
          dismissed: 'Dismissed',
        },
        confirmSighting: 'Confirm',
        dismissSighting: 'Dismiss',
        remove: 'Remove case',
        removeTitle: 'Remove this case?',
        removeIntro:
          'This removes the case from your account and takes its public page offline. Your pet profile will stay saved.',
        confirmRemove: 'Remove case',
        removeError: 'We could not remove this case. Please try again.',
        removed: 'Case removed.',
        status: {
          draft: 'Draft',
          published: 'Still missing — public',
          closed: 'Closed — not public',
          reunited: 'Reunited — not public',
          removed: 'Removed',
          expired: 'Expired',
        },
      },
      sighting: {
        progress: 'Report a sighting',
        eyebrow: 'No account needed',
        title: 'Tell us what you saw.',
        intro:
          'A clear report gives an owner useful information without sharing your contact details publicly.',
        petQuestion: 'Do you know which pet this might be?',
        petOrCase: 'Pet or case',
        unknownPet: 'I’m not sure / a different pet',
        petHelp:
          'Choose a missing-pet case if one looks like the pet you saw. This is optional.',
        choosePet: 'Choose a missing pet',
        choosePetTitle: 'Which pet did you see?',
        choosePetIntro:
          'Look through active missing-pet cases and select the closest match.',
        casePickerLoading: 'Loading missing-pet cases…',
        casePickerError:
          'We could not load missing-pet cases. You can still continue without linking one.',
        noMatch: 'None of these pets match',
        closePicker: 'Close pet picker',
        selectedPet: 'Linked missing-pet case',
        changePet: 'Change',
        removePet: 'Remove {{petName}} from this sighting',
        whenWhere: 'Where and when?',
        where: 'Where did you see the pet?',
        whereHint: 'Street, park or landmark',
        when: 'When did you see them?',
        whenHint: 'For example, today at 5:15 pm',
        detailsQuestion: 'What did you notice?',
        details: 'Details',
        detailsHint:
          'Colour, collar, direction of travel or anything else that may help.',
        addPhoto: 'Add a photo',
        photoHint: 'Optional, but helpful if it is safe to take one.',
        privacy:
          'Your exact location is shared only with the linked case owner and Pet Seen administrators.',
        locationHelp:
          'Use your current location, search by postcode or place, or choose a point on the map.',
        useLocation: 'Use my location',
        searchLocation: 'Search by postcode or place',
        searchLocationHint: 'For example, SW1A 1AA or Hyde Park',
        search: 'Search',
        searching: 'Searching…',
        searchNoResults:
          'No places matched that search. Try a more specific postcode or place name.',
        searchError:
          'We could not search for that place. You can still choose a point on the map.',
        pinNote:
          'Tap the map or drag a pin to confirm the exact place you saw the pet.',
        pinConfirmed:
          'Location selected. Drag the pin or tap the map to adjust it.',
        latitude: 'Latitude',
        longitude: 'Longitude',
        locationUnavailable:
          'Your browser cannot provide a location. Place the pin on the map instead.',
        locationDenied:
          'We could not access your location. Allow location access and try again, or place the pin on the map.',
        invalidLocation: 'Place the pin on the map to confirm the location.',
        unavailable: 'Sighting reports are unavailable in this environment.',
        submitError:
          'We could not send your sighting. Your details are saved on this device.',
        retry: 'Try again',
        offline:
          'You are offline. You can keep filling in the form and submit when you reconnect.',
        offlineSaved:
          'Your sighting is saved on this device. Reconnect, then try again.',
        draftRestored: 'Your saved sighting draft has been restored.',
        submitting: 'Submitting…',
        thanksTitle: 'Sighting shared.',
        thanksBody:
          'Thank you. If you linked a case, its owner can now see the exact place and time you reported.',
      },
      found: {
        progress: 'Found-pet report',
        eyebrow: 'No account needed',
        title: 'Tell us about the pet you found.',
        intro:
          'Record the details, where they were found and whether they are safe with you.',
        petDetails: 'What does the pet look like?',
        species: 'Species',
        breed: 'Breed',
        breedHint: 'For example, tabby',
        markings: 'Colour or markings',
        markingsHint: 'For example, ginger with a white chest',
        details: 'Helpful details',
        detailsHint:
          'Collar, temperament, condition or anything else that may help identify them.',
        photo: 'Photo (optional)',
        addPhoto: 'Add a photo of the pet',
        photoHint:
          'JPG or PNG, up to 5 MB. Please photograph the pet, not a person. We remove photo metadata before matching.',
        invalidPhoto: 'Choose a JPG or PNG image no larger than 5 MB.',
        preparePhotoError:
          'We could not prepare that photo. Try a different JPG or PNG image.',
        photoUploadError:
          'Your report was saved, but we could not add the photo.',
        photoProcessError:
          'Your report was saved, but we could not process the photo.',
        custodyQuestion: 'Where is the pet now?',
        custodyHelp:
          'Choose the option that best describes their current situation.',
        custody: {
          with_reporter: 'Safe with me',
          with_vet_or_rescue: 'With a vet, rescue or shelter',
          not_in_custody: 'I am no longer with the pet',
        },
        custodyDetails: {
          with_vet_or_rescue: {
            label: 'More information',
            hint: 'For example, the name and location of the vet, rescue or shelter.',
          },
          not_in_custody: {
            label: 'More information',
            hint: 'For example, who has the pet now or where you last saw them.',
          },
        },
        whenWhere: 'When and where did you find them?',
        where: 'Where did you find the pet?',
        whereHint: 'Street, park or landmark',
        when: 'When did you find them?',
        locationHelp:
          'Use your current location, search by postcode or place, or choose a point on the map.',
        useLocation: 'Use my location',
        searchLocation: 'Search by postcode or place',
        searchLocationHint: 'For example, SW1A 1AA or Hyde Park',
        search: 'Search',
        searching: 'Searching…',
        searchNoResults:
          'No places matched that search. Try a more specific postcode or place name.',
        searchError:
          'We could not search for that place. You can still choose a point on the map.',
        pinNote:
          'Tap the map or drag a pin to confirm where the pet was found.',
        pinConfirmed:
          'Location selected. Drag the pin or tap the map to adjust it.',
        locationUnavailable:
          'Your browser cannot provide a location. Place the pin on the map instead.',
        locationDenied:
          'We could not access your location. Allow location access and try again, or place the pin on the map.',
        invalidLocation: 'Place the pin on the map to confirm the location.',
        unavailable: 'Found-pet reports are unavailable in this environment.',
        submitError: 'We could not send your report. Please try again.',
        submitting: 'Saving report…',
        submit: 'Save found-pet report',
        privacy:
          'Your exact location and optional pet photo are private. They are available only for Pet Seen matching and owner review.',
        thanksTitle: 'Found-pet report saved.',
        thanksBody:
          'Thank you for recording these details. This report is private and is not published as a public listing.',
        nextStep:
          'If it is safe to do so, a local vet, rescue or shelter may be able to scan the pet’s microchip.',
        followUpTitle: 'Stay in touch (optional)',
        followUpHelp:
          'Add your email to receive a secure sign-in link. If an owner confirms a match, you can message privately without sharing your email address.',
        followUpEmail: 'Email address',
        followUpEmailHint: 'you@example.com',
        followUpSent: 'We sent a secure follow-up link to {{email}}.',
        followUpSignInTitle: 'Check on your found-pet report.',
        followUpSignInBody:
          'Sign in with the email you used when you made the report.',
        followUpPageTitle: 'Your found-pet reports',
        followUpPageIntro:
          'Private messages are available only after an owner confirms a match.',
        followUpLoadError: 'We could not load your reports. Please try again.',
        followUpEmptyTitle: 'No follow-up reports found.',
        followUpEmptyBody:
          'Use the email address entered with a found-pet report, or submit a new report.',
        followUpAwaitingOwner:
          'The owner is reviewing this possible match. We’ll open private messaging if they confirm it.',
        followUpNoMatch:
          'No confirmed match yet. Your report remains private while Pet Seen reviews possible matches.',
        conversationTitle: 'Private messages',
        conversationHelp:
          'Messages are visible only to you and the confirmed case owner. Do not share payment details or other sensitive information.',
        messageLabel: 'Message',
        messageSend: 'Send message',
        messageSending: 'Sending…',
      },
      auth: {
        eyebrow: 'Account access',
        title: 'Sign in with your email.',
        accountTitle: 'Your account',
        intro: 'We’ll email you a secure link. No password is needed.',
        emailLabel: 'Email address',
        emailHint: 'you@example.com',
        sendLink: 'Email me a sign-in link',
        sentTitle: 'Check your email.',
        sentBody: 'We sent a secure sign-in link to {{email}}.',
        toast: 'You’re signed in.',
        privacy:
          'We use your email only to secure your account and contact you about your cases.',
        setupNote:
          'Authentication needs local environment settings before you can send a sign-in link.',
        notConfigured: 'Authentication is not configured in this environment.',
        loading: 'Checking your sign-in status…',
        signedInTitle: 'You’re signed in.',
        signedInBody: 'Your account is using {{email}}.',
        signOut: 'Sign out',
      },
      placeholders: {
        laterRelease: 'Later release',
        foundTitle: 'Found-pet reports are coming next.',
        foundBody:
          'For now, please use a sighting report to share where you saw a pet.',
        accountAccess: 'Account access',
        authTitle: 'Sign in will use a secure email link.',
        authBody:
          'You will not need a password. This is being built with the missing-pet case flow.',
        notFound: 'Not found',
        notFoundTitle: 'This page is not here yet.',
      },
      footer: 'Helping pets get home, together.',
    },
  },
  'es-419': {
    translation: {
      language: {
        label: 'Idioma',
        english: 'Inglés',
        spanish: 'Español (LatAm)',
      },
      common: {
        petSeenHome: 'Inicio de Pet Seen',
        backToHome: 'Volver al inicio',
        backToCases: 'Todos los casos de Pet Seen',
        nearbyPets: 'Mascotas cerca',
        signIn: 'Iniciar sesión',
        account: 'Mi cuenta',
        continue: 'Continuar',
        submitSighting: 'Enviar avistamiento',
        yes: 'Sí',
        no: 'No',
        goHome: 'Ir al inicio',
        skipToContent: 'Ir al contenido principal',
        dog: 'Perro',
        cat: 'Gato',
        young: 'Joven',
        adult: 'Adulto',
        senior: 'Mayor',
      },
      home: {
        eyebrow: 'Ayudamos a que las mascotas vuelvan a casa',
        title: '¿Qué pasó?',
        intro:
          'Elige la opción que mejor describa la situación. Puedes reportar un avistamiento sin crear una cuenta.',
        missingLabel: 'Mi mascota está perdida',
        missingDescription:
          'Crea un caso de mascota perdida y compártelo con personas cerca.',
        sightingLabel: 'Vi una mascota',
        sightingDescription:
          'Una foto, el lugar y la hora pueden ayudar a que una mascota vuelva a casa.',
        foundLabel: 'Encontré una mascota',
        foundDescription:
          'Registra los detalles y el lugar donde encontraste una mascota que podría estar a salvo contigo.',
        howItWorks: 'Cómo funciona Pet Seen',
        howItWorksTitle: 'Reportes claros para las personas cerca.',
        essentialsTitle: 'Comparte lo esencial.',
        essentialsBody:
          'Agrega una foto, el último lugar donde se vio a la mascota y una descripción útil.',
        privacyTitle: 'Mantén privados los lugares exactos.',
        privacyBody:
          'Los mapas públicos muestran un área más amplia, mientras que la persona dueña ve los detalles precisos.',
        neighboursTitle: 'Dale a tus vecinos una forma de ayudar.',
        neighboursBody:
          'Cada caso público tiene un formulario sencillo para reportar avistamientos.',
      },
      nearby: {
        eyebrow: 'Cerca',
        title: 'Mascotas perdidas en la zona',
        intro:
          'Primero revisa los casos activos; luego cambia al mapa para una vista más amplia.',
        showMap: 'Ver mapa',
        showList: 'Ver lista',
        loading: 'Cargando casos cercanos…',
        unavailable: 'La búsqueda cercana no está disponible ahora.',
        empty: 'Aún no hay casos activos de mascotas perdidas cerca.',
        missingLabel: 'Mascota perdida',
        missingLegend: 'Caso de mascota perdida',
        sightingLegend: 'Avistamiento confirmado y aproximado',
        casePin: 'Área aproximada donde se perdió {{petName}}',
        sightingPin: 'Avistamiento confirmado aproximado',
        mapLabel:
          'Mapa de áreas aproximadas de mascotas perdidas y avistamientos confirmados',
      },
      missingCase: {
        progress: 'Caso de mascota perdida',
        step: 'Paso {{current}} de {{total}}',
        eyebrow: 'Inicia un caso',
        title: 'Cuéntanos sobre tu mascota.',
        intro:
          'Te ayudaremos a crear una página para compartir. Podrás revisar todo antes de que se publique.',
        details: 'Datos de la mascota',
        petName: 'Nombre de la mascota',
        species: 'Especie',
        breed: 'Raza',
        breedHint: 'Por ejemplo, border collie',
        markings: 'Color o marcas',
        markingsHint: 'Por ejemplo, negro con el pecho blanco',
        description: 'Detalles útiles',
        descriptionHint:
          'Collar, temperamento o cualquier detalle que ayude a reconocer a tu mascota.',
        photo: 'Foto',
        addPhoto: 'Agrega una foto clara',
        photoHint:
          'JPG o PNG, hasta 10 MB. Quitamos los metadatos antes de compartirla.',
        invalidPhoto: 'Elige una imagen JPG o PNG de hasta 10 MB.',
        preparePhotoError:
          'No pudimos preparar esa foto. Prueba con otra imagen JPG o PNG.',
        photoProcessError:
          'No pudimos procesar esa foto. Elige otra imagen JPG o PNG.',
        saving: 'Guardando datos de la mascota…',
        saveError:
          'No pudimos guardar los datos de tu mascota. Inténtalo de nuevo.',
        signInTitle: 'Inicia sesión para comenzar un caso.',
        signInBody:
          'Los casos de mascotas perdidas están vinculados a una cuenta para que puedas gestionarlos de forma segura.',
        savedTitle: 'Datos de la mascota guardados.',
        savedBody:
          'Tu mascota está lista para el siguiente paso: agregar dónde se vio por última vez.',
        lastSeenQuestion:
          '¿Cuándo y dónde se vio por última vez a {{petName}}?',
        lastSeen: 'Última vez visto',
        location: 'Lugar',
        exactLocationNote:
          'Este lugar exacto solo será visible para ti y las personas administradoras de Pet Seen.',
      },
      publicCase: {
        imageDescription:
          'Ilustración de {{petName}}, un perro negro con el pecho blanco',
        status: 'Perdido',
        title: '{{petName}} está perdido.',
        lead: 'Un perro blanco y negro perdido en Victoria Park, Hackney.',
        leadForPet:
          '{{petName}} está perdido/a. Comparte un avistamiento si puedes ayudar.',
        lastSeen: 'Última vez visto',
        lastSeenValue: 'Hoy alrededor de las 4:30 p. m.',
        lastSeenUnknown: 'No se indicó la hora',
        area: 'Área',
        areaValue: 'Zona de Victoria Park',
        approximateArea: 'Área aproximada',
        action: 'Vi a {{petName}}',
        privacy:
          'Tu reporte puede incluir el lugar exacto. Solo se comparte con la persona dueña de {{petName}} y las personas administradoras de Pet Seen.',
        about: 'Sobre {{petName}}',
        descriptionTitle: 'Más información',
        description:
          '{{petName}} es un perro mediano y amigable. Llevaba un collar rojo desgastado. Por favor, no lo persigas; mejor reporta dónde y cuándo lo viste.',
        mapNote:
          'Esta zona de búsqueda de 100 m de ancho incluye el lugar donde se vio por última vez a {{petName}}. La ubicación exacta no se muestra.',
        mapLabel: 'Área de búsqueda aproximada de 100 metros para {{petName}}',
        loadingTitle: 'Cargando este caso',
        loadingBody: 'Espera mientras obtenemos los datos públicos del caso.',
        notFoundTitle: 'Este caso ya no está disponible.',
        notFoundBody:
          'Puede que se haya cerrado o que el enlace sea incorrecto.',
        unavailableTitle: 'Este caso público no está disponible.',
        unavailableBody: 'Inténtalo de nuevo en unos momentos.',
        shareEyebrow: 'Ayuda a compartir el caso',
        shareTitle: 'Comparte este caso',
        shareIntro:
          'Envía la página pública a personas cercanas. Solo muestra un área aproximada.',
        shareText: '¿Has visto a {{petName}}? Revisa este caso de Pet Seen.',
        copyLink: 'Copiar enlace',
        copied: 'Enlace copiado.',
        copyError:
          'No pudimos copiar el enlace. Cópialo desde la barra de direcciones.',
        share: 'Compartir',
        shared: 'Gracias por compartir.',
        shareError:
          'No pudimos abrir las opciones para compartir. Intenta copiar el enlace.',
        whatsApp: 'WhatsApp',
        poster: 'Imprimir cartel',
        print: 'Imprimir cartel',
        posterLabel: 'Cartel de mascota perdida para {{petName}}',
        posterAlert: 'Mascota perdida',
        qrAlt:
          'Código QR que enlaza al caso público de {{petName}} en Pet Seen',
        qrTitle: '¿Has visto a esta mascota?',
        qrBody:
          'Escanea el código o visita este enlace para reportar un avistamiento.',
      },
      contentReport: {
        trigger: 'Reportar este caso',
        title: 'Reporta un problema con este caso.',
        intro:
          'Cuéntanos qué parece incorrecto. El equipo de Pet Seen revisará tu reporte.',
        reason: 'Motivo',
        details: 'Más detalles (opcional)',
        submit: 'Enviar reporte',
        sending: 'Enviando…',
        error: 'No pudimos enviar tu reporte. Inténtalo de nuevo.',
        thanksTitle: 'Reporte recibido.',
        thanksBody: 'Gracias. El equipo de Pet Seen lo revisará.',
        reasons: {
          incorrect: 'Información incorrecta o desactualizada',
          harmful: 'Contenido dañino o inseguro',
          scam: 'Posible estafa o suplantación',
          other: 'Otro motivo',
        },
      },
      moderation: {
        eyebrow: 'Área del equipo',
        title: 'Reportes de contenido',
        intro:
          'Revisa los reportes de las páginas públicas y registra el resultado.',
        checking: 'Comprobando acceso del equipo…',
        deniedTitle: 'Esta área es para el equipo de Pet Seen.',
        deniedBody:
          'Inicia sesión con una cuenta autorizada para revisar los reportes de contenido.',
        loading: 'Cargando reportes…',
        error: 'No pudimos cargar la cola de moderación. Inténtalo de nuevo.',
        emptyTitle: 'No hay reportes por revisar.',
        emptyBody:
          'Los nuevos reportes de las páginas públicas aparecerán aquí.',
        unavailableCase: 'Caso no disponible',
        viewCase: 'Ver caso público',
        statusLabel: 'Estado del reporte',
        status: {
          open: 'Abierto',
          reviewed: 'Revisado',
          dismissed: 'Descartado',
          actioned: 'Con acción',
        },
        foundMatches: 'Coincidencias de mascotas encontradas',
        foundMatchesIntro:
          'Cada reporte permanece privado hasta que el equipo revise el texto y cualquier foto. Solo los reportes aprobados pueden vincularse o compartirse con una persona dueña.',
        noFoundReports:
          'No hay reportes de mascotas encontradas para vincular.',
        noFoundReportsBody: 'Los nuevos reportes privados aparecerán aquí.',
        foundPet: 'Mascota encontrada',
        custody: 'Situación actual',
        foundLocation: 'Encontrada cerca de',
        findMatches: 'Buscar coincidencias',
        findingMatches: 'Buscando coincidencias…',
        noCandidates: 'No hay casos activos que coincidan.',
        linkedTo: 'Vinculado con {{petName}}',
        case: 'caso',
        linkCase: 'Vincular caso',
        linking: 'Vinculando…',
        lastSeenUnknown: 'No hay hora de última vez visto',
        contentReports: 'Reportes de contenido',
        moderationPending: 'Pendiente de revisión',
        moderationApproved: 'Aprobado',
        moderationRejected: 'Rechazado',
        automatedFlag: 'Comprobación automática: {{note}}',
        approve: 'Aprobar reporte',
        reject: 'Rechazar y eliminar archivos',
        reviewing: 'Guardando decisión…',
        photo: 'Foto enviada',
        photoUnavailable: 'La foto enviada no está disponible.',
        activeQueue: 'Reportes activos de mascotas encontradas',
        closedQueue: 'Reportes resueltos o vencidos ({{count}})',
        lifecycle: {
          active: 'Activo',
          resolved: 'Resuelto',
          expired: 'Vencido',
        },
        lifecycleReason: 'Motivo del ciclo: {{reason}}',
        lifecycleReasonLabel: 'Motivo',
        reason: {
          resolved: 'Resuelto de forma segura',
          duplicate: 'Reporte duplicado',
          test: 'Reporte de prueba',
          stale: 'Reporte desactualizado',
          other: 'Otro',
        },
        resolve: 'Resolver',
        expire: 'Vencer',
        reopen: 'Reabrir reporte',
        deleteReport: 'Eliminar reporte',
        savingLifecycle: 'Guardando…',
        runHousekeeping: 'Ejecutar mantenimiento',
        runningHousekeeping: 'Ejecutando mantenimiento…',
        housekeepingError:
          'No pudimos completar el mantenimiento. Inténtalo de nuevo.',
      },
      dashboard: {
        eyebrow: 'Tus casos',
        title: 'Administra tus casos de mascotas perdidas.',
        intro:
          'Mantén los detalles actualizados y cierra el caso cuando ya no necesite compartirse.',
        newCase: 'Iniciar un caso nuevo',
        loading: 'Cargando tus casos…',
        loadError: 'No pudimos cargar tus casos. Inténtalo de nuevo.',
        signInTitle: 'Inicia sesión para administrar tus casos.',
        signInBody:
          'Tus casos están vinculados a tu cuenta para que solo tú puedas actualizarlos.',
        emptyTitle: 'Aún no tienes casos de mascotas perdidas.',
        emptyBody: 'Inicia un caso cuando necesites ayuda de personas cerca.',
        viewPublic: 'Ver página pública',
        pet: 'Mascota',
        caseTitle: 'Título del caso',
        petName: 'Nombre de la mascota',
        breed: 'Raza',
        colour: 'Color o marcas',
        description: 'Detalles útiles',
        lastSeenPlace: 'Lugar o punto de referencia de la última vez visto',
        lastSeenTime: 'Hora de la última vez visto',
        locationNote: 'Las ubicaciones exactas nunca se muestran públicamente.',
        saveChanges: 'Guardar cambios',
        saving: 'Guardando…',
        saved: 'Tus cambios se guardaron.',
        saveError: 'No pudimos guardar esos cambios. Inténtalo de nuevo.',
        statusError: 'No pudimos actualizar este caso. Inténtalo de nuevo.',
        statusSaved: 'El estado del caso se actualizó.',
        edit: 'Editar detalles',
        changeStatus: 'Estado del caso',
        reunitedNote: 'Marcado como reunido. Este caso ya no es público.',
        closedNote: 'Este caso está cerrado y ya no es público.',
        cancel: 'Cancelar',
        sightings: 'Reportes de avistamientos',
        sightingTimeline: 'Ubicaciones exactas de los avistamientos',
        sightingPrivacy:
          'Estas ubicaciones son privadas para ti y el equipo de Pet Seen.',
        coordinates: 'Ubicación exacta en el mapa',
        sightingStatusError:
          'No pudimos actualizar este avistamiento. Inténtalo de nuevo.',
        sightingStatusSaved: 'El estado del avistamiento se actualizó.',
        markReunited: 'Marcar como reunido',
        reunionTitle: 'Cuéntanos sobre el reencuentro.',
        reunionIntro:
          'Esto ayuda a Pet Seen a entender qué marcó la diferencia.',
        reunionReason: '¿Cómo se reunió con su mascota?',
        reunionReasons: {
          returned_home: 'Volvió a casa',
          found_by_neighbour: 'Una persona vecina la encontró',
          seen_after_report: 'Un avistamiento ayudó a encontrarla',
          other: 'De otra manera',
        },
        petSeenHelped: '¿Pet Seen ayudó con el reencuentro?',
        confirmReunion: 'Confirmar reencuentro',
        sightingStatus: {
          pending: 'Pendiente de revisión',
          confirmed: 'Confirmado',
          dismissed: 'Descartado',
        },
        confirmSighting: 'Confirmar',
        dismissSighting: 'Descartar',
        remove: 'Eliminar caso',
        removeTitle: '¿Eliminar este caso?',
        removeIntro:
          'Esto elimina el caso de tu cuenta y quita su página pública. El perfil de tu mascota seguirá guardado.',
        confirmRemove: 'Eliminar caso',
        removeError: 'No pudimos eliminar este caso. Inténtalo de nuevo.',
        removed: 'Caso eliminado.',
        status: {
          draft: 'Borrador',
          published: 'Aún perdida — público',
          closed: 'Cerrado — no público',
          reunited: 'Reunido — no público',
          removed: 'Eliminado',
          expired: 'Vencido',
        },
      },
      sighting: {
        progress: 'Reportar un avistamiento',
        eyebrow: 'No necesitas una cuenta',
        title: 'Cuéntanos qué viste.',
        intro:
          'Un reporte claro le da a la persona dueña información útil sin mostrar públicamente tus datos de contacto.',
        petQuestion: '¿Sabes qué mascota podría ser?',
        petOrCase: 'Mascota o caso',
        unknownPet: 'No estoy seguro/a / es otra mascota',
        petHelp:
          'Elige un caso de mascota perdida si se parece a la mascota que viste. Es opcional.',
        choosePet: 'Elegir una mascota perdida',
        choosePetTitle: '¿Qué mascota viste?',
        choosePetIntro:
          'Revisa los casos activos y selecciona la coincidencia más cercana.',
        casePickerLoading: 'Cargando casos de mascotas perdidas…',
        casePickerError:
          'No pudimos cargar los casos de mascotas perdidas. Aún puedes continuar sin vincular uno.',
        noMatch: 'Ninguna de estas mascotas coincide',
        closePicker: 'Cerrar el selector de mascotas',
        selectedPet: 'Caso de mascota perdida vinculado',
        changePet: 'Cambiar',
        removePet: 'Quitar a {{petName}} de este avistamiento',
        whenWhere: '¿Dónde y cuándo?',
        where: '¿Dónde viste a la mascota?',
        whereHint: 'Calle, parque o punto de referencia',
        when: '¿Cuándo la viste?',
        whenHint: 'Por ejemplo, hoy a las 5:15 p. m.',
        detailsQuestion: '¿Qué notaste?',
        details: 'Detalles',
        detailsHint:
          'Color, collar, dirección en la que iba o cualquier otro dato que pueda ayudar.',
        addPhoto: 'Agrega una foto',
        photoHint: 'Es opcional, pero ayuda si puedes tomarla sin riesgo.',
        privacy:
          'Tu ubicación exacta se comparte solo con la persona dueña del caso vinculado y las personas administradoras de Pet Seen.',
        locationHelp:
          'Usa tu ubicación actual, busca por código postal o lugar, o elige un punto en el mapa.',
        useLocation: 'Usar mi ubicación',
        searchLocation: 'Buscar por código postal o lugar',
        searchLocationHint: 'Por ejemplo, SW1A 1AA o Hyde Park',
        search: 'Buscar',
        searching: 'Buscando…',
        searchNoResults:
          'No encontramos lugares con esa búsqueda. Prueba con un código postal o lugar más específico.',
        searchError:
          'No pudimos buscar ese lugar. Aún puedes elegir un punto en el mapa.',
        pinNote:
          'Toca el mapa o arrastra un pin para confirmar el lugar exacto donde viste a la mascota.',
        pinConfirmed:
          'Ubicación seleccionada. Arrastra el pin o toca el mapa para ajustarla.',
        latitude: 'Latitud',
        longitude: 'Longitud',
        locationUnavailable:
          'Tu navegador no puede proporcionar una ubicación. Coloca el pin en el mapa.',
        locationDenied:
          'No pudimos acceder a tu ubicación. Permite el acceso y vuelve a intentarlo, o coloca el pin en el mapa.',
        invalidLocation:
          'Coloca el pin en el mapa para confirmar la ubicación.',
        unavailable:
          'Los reportes de avistamientos no están disponibles en este entorno.',
        submitError:
          'No pudimos enviar tu avistamiento. Tus datos se guardaron en este dispositivo.',
        retry: 'Intentar de nuevo',
        offline:
          'No tienes conexión. Puedes seguir llenando el formulario y enviarlo cuando vuelvas a conectarte.',
        offlineSaved:
          'Tu avistamiento se guardó en este dispositivo. Vuelve a conectarte e inténtalo de nuevo.',
        draftRestored: 'Restauramos tu borrador guardado.',
        submitting: 'Enviando…',
        thanksTitle: 'Avistamiento compartido.',
        thanksBody:
          'Gracias. Si vinculaste un caso, su persona dueña ya puede ver el lugar y hora exactos que reportaste.',
      },
      found: {
        progress: 'Reporte de mascota encontrada',
        eyebrow: 'No necesitas una cuenta',
        title: 'Cuéntanos sobre la mascota que encontraste.',
        intro:
          'Registra los detalles, dónde la encontraste y si está a salvo contigo.',
        petDetails: '¿Cómo es la mascota?',
        species: 'Especie',
        breed: 'Raza',
        breedHint: 'Por ejemplo, atigrado',
        markings: 'Color o marcas',
        markingsHint: 'Por ejemplo, anaranjado con el pecho blanco',
        details: 'Detalles útiles',
        detailsHint:
          'Collar, temperamento, estado o cualquier otro dato que ayude a identificarla.',
        custodyQuestion: '¿Dónde está la mascota ahora?',
        custodyHelp: 'Elige la opción que mejor describa su situación actual.',
        custody: {
          with_reporter: 'Está a salvo conmigo',
          with_vet_or_rescue: 'Está con un veterinario, rescate o refugio',
          not_in_custody: 'Ya no estoy con la mascota',
        },
        custodyDetails: {
          with_vet_or_rescue: {
            label: 'Más información',
            hint: 'Por ejemplo, el nombre y la ubicación del veterinario, rescate o refugio.',
          },
          not_in_custody: {
            label: 'Más información',
            hint: 'Por ejemplo, quién tiene ahora la mascota o dónde la viste por última vez.',
          },
        },
        whenWhere: '¿Cuándo y dónde la encontraste?',
        where: '¿Dónde encontraste la mascota?',
        whereHint: 'Calle, parque o punto de referencia',
        when: '¿Cuándo la encontraste?',
        locationHelp:
          'Usa tu ubicación actual, busca por código postal o lugar, o elige un punto en el mapa.',
        useLocation: 'Usar mi ubicación',
        searchLocation: 'Buscar por código postal o lugar',
        searchLocationHint: 'Por ejemplo, SW1A 1AA o Hyde Park',
        search: 'Buscar',
        searching: 'Buscando…',
        searchNoResults:
          'No encontramos lugares con esa búsqueda. Prueba con un código postal o lugar más específico.',
        searchError:
          'No pudimos buscar ese lugar. Aún puedes elegir un punto en el mapa.',
        pinNote:
          'Toca el mapa o arrastra un pin para confirmar dónde encontraste la mascota.',
        pinConfirmed:
          'Ubicación seleccionada. Arrastra el pin o toca el mapa para ajustarla.',
        locationUnavailable:
          'Tu navegador no puede proporcionar una ubicación. Coloca el pin en el mapa.',
        locationDenied:
          'No pudimos acceder a tu ubicación. Permite el acceso y vuelve a intentarlo, o coloca el pin en el mapa.',
        invalidLocation:
          'Coloca el pin en el mapa para confirmar la ubicación.',
        unavailable:
          'Los reportes de mascotas encontradas no están disponibles en este entorno.',
        submitError: 'No pudimos enviar tu reporte. Inténtalo de nuevo.',
        submitting: 'Guardando reporte…',
        submit: 'Guardar reporte de mascota encontrada',
        privacy:
          'Tu ubicación exacta es privada. Solo está disponible para las personas administradoras de Pet Seen mientras desarrollamos las coincidencias y el seguimiento directo.',
        thanksTitle: 'Reporte de mascota encontrada guardado.',
        thanksBody:
          'Gracias por registrar estos detalles. El reporte es privado y no se publica como una lista pública.',
        nextStep:
          'Si es seguro hacerlo, un veterinario, rescate o refugio local podría escanear el microchip de la mascota.',
        followUpTitle: 'Mantente en contacto (opcional)',
        followUpHelp:
          'Agrega tu correo para recibir un enlace de acceso seguro. Si una persona dueña confirma una coincidencia, podrán enviarse mensajes privados sin compartir tu correo.',
        followUpEmail: 'Correo electrónico',
        followUpEmailHint: 'tu@ejemplo.com',
        followUpSent: 'Enviamos un enlace seguro de seguimiento a {{email}}.',
        followUpSignInTitle: 'Consulta tu reporte de mascota encontrada.',
        followUpSignInBody:
          'Inicia sesión con el correo que usaste al crear el reporte.',
        followUpPageTitle: 'Tus reportes de mascotas encontradas',
        followUpPageIntro:
          'Los mensajes privados solo están disponibles cuando una persona dueña confirma la coincidencia.',
        followUpLoadError:
          'No pudimos cargar tus reportes. Inténtalo de nuevo.',
        followUpEmptyTitle: 'No encontramos reportes de seguimiento.',
        followUpEmptyBody:
          'Usa el correo que ingresaste con el reporte o crea uno nuevo.',
        followUpAwaitingOwner:
          'La persona dueña está revisando esta posible coincidencia. Abriremos los mensajes privados si la confirma.',
        followUpNoMatch:
          'Aún no hay una coincidencia confirmada. Tu reporte sigue siendo privado mientras Pet Seen revisa posibles coincidencias.',
        conversationTitle: 'Mensajes privados',
        conversationHelp:
          'Solo tú y la persona dueña confirmada pueden ver estos mensajes. No compartas datos de pago ni otra información sensible.',
        messageLabel: 'Mensaje',
        messageSend: 'Enviar mensaje',
        messageSending: 'Enviando…',
      },
      auth: {
        eyebrow: 'Acceso a la cuenta',
        title: 'Inicia sesión con tu correo electrónico.',
        accountTitle: 'Tu cuenta',
        intro: 'Te enviaremos un enlace seguro. No necesitas contraseña.',
        emailLabel: 'Correo electrónico',
        emailHint: 'tu@ejemplo.com',
        sendLink: 'Enviarme un enlace para iniciar sesión',
        sentTitle: 'Revisa tu correo electrónico.',
        sentBody: 'Enviamos un enlace seguro a {{email}}.',
        toast: 'Has iniciado sesión.',
        privacy:
          'Usamos tu correo electrónico solo para proteger tu cuenta y contactarte sobre tus casos.',
        setupNote:
          'La autenticación necesita ajustes del entorno local antes de que puedas enviar un enlace.',
        notConfigured: 'La autenticación no está configurada en este entorno.',
        loading: 'Revisando tu estado de inicio de sesión…',
        signedInTitle: 'Has iniciado sesión.',
        signedInBody: 'Tu cuenta usa {{email}}.',
        signOut: 'Cerrar sesión',
      },
      placeholders: {
        laterRelease: 'Próxima versión',
        foundTitle: 'Los reportes de mascotas encontradas llegarán pronto.',
        foundBody:
          'Por ahora, usa un reporte de avistamiento para compartir dónde viste a una mascota.',
        accountAccess: 'Acceso a la cuenta',
        authTitle:
          'El inicio de sesión usará un enlace seguro por correo electrónico.',
        authBody:
          'No necesitarás una contraseña. Estamos creando esta función junto con el flujo de mascotas perdidas.',
        notFound: 'No encontrado',
        notFoundTitle: 'Esta página todavía no existe.',
      },
      footer: 'Ayudamos a que las mascotas vuelvan a casa, juntos.',
    },
  },
} as const

export type AppLocale = keyof typeof resources
