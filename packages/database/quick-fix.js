const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function quickFix() {
  try {
    // Get an existing doctor to copy the structure
    const existingDoctor = await prisma.doctor.findFirst({
      where: { slug: 'dr-jose' }
    });

    console.log('Creating doctor profile based on existing structure...');

    // Create new doctor with same structure
    const newDoctor = await prisma.doctor.create({
      data: {
        slug: 'admin-gerardo',
        doctorFullName: 'Gerardo López Admin',
        lastName: 'López',
        primarySpecialty: existingDoctor.primarySpecialty,
        subspecialties: [],
        cedulaProfesional: '00000000',
        heroImage: existingDoctor.heroImage,
        locationSummary: existingDoctor.locationSummary,
        city: existingDoctor.city,
        shortBio: 'Admin access profile',
        longBio: 'Placeholder profile for admin access',
        yearsExperience: 0,
        conditions: [],
        procedures: [],
        appointmentModes: existingDoctor.appointmentModes,
        clinicAddress: existingDoctor.clinicAddress,
        clinicPhone: existingDoctor.clinicPhone,
        clinicHours: existingDoctor.clinicHours,
        status: 'professional'
      }
    });

    console.log('✅ Created doctor:', newDoctor.id);

    // Link to admin
    const user = await prisma.user.update({
      where: { email: 'lopez.fafutis@gmail.com' },
      data: { doctorId: newDoctor.id }
    });

    console.log('✅ Linked to admin user');
    console.log('   Email:', user.email);
    console.log('   DoctorId:', user.doctorId);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

quickFix();
