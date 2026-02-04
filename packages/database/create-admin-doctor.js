const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdminDoctor() {
  try {
    // Create a placeholder doctor profile for admin with ALL required fields
    const doctor = await prisma.doctor.create({
      data: {
        slug: 'admin-profile',
        doctorFullName: 'Admin User',
        lastName: 'User',
        primarySpecialty: 'Administration',
        subspecialties: [],
        heroImage: 'https://utfs.io/f/63e9Mv5a2tPSaIDAwxGKwlUskK6V9oyH12AC5tTrgbImujEW',
        locationSummary: 'Admin',
        city: 'Admin',
        shortBio: 'Admin placeholder profile',
        longBio: 'This is a placeholder doctor profile for admin access',
        yearsExperience: 0,
        conditions: [],
        procedures: [],
        appointmentModes: ['in_person'],
        clinicAddress: 'Admin',
        clinicPhone: '0000000000',
        clinicHours: { "monday": "9:00 AM - 5:00 PM" },
        status: 'professional'
      }
    });

    console.log('✅ Created doctor profile:', doctor.id);

    // Link it to admin user
    const user = await prisma.user.update({
      where: { email: 'lopez.fafutis@gmail.com' },
      data: { doctorId: doctor.id }
    });

    console.log('✅ Linked to admin user:', user.email);
    console.log('   DoctorId:', user.doctorId);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminDoctor();
