const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDoctorUser() {
  try {
    // Check who has this doctor profile
    const user = await prisma.user.findFirst({
      where: { doctorId: 'cmjad41j600blmg0m1ziudezw' }
    });

    console.log('User with this doctor profile:');
    console.log(user);

    // Check admin user
    const admin = await prisma.user.findUnique({
      where: { email: 'lopez.fafutis@gmail.com' }
    });

    console.log('\nAdmin user:');
    console.log(admin);

    // List all doctors
    const doctors = await prisma.doctor.findMany({
      select: { id: true, slug: true, doctorFullName: true }
    });

    console.log('\nAll doctors:');
    console.log(doctors);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDoctorUser();
