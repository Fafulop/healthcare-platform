const { PrismaClient } = require('@healthcare/database');

const prisma = new PrismaClient();

async function linkAdminToDoctor() {
  try {
    const result = await prisma.user.update({
      where: { email: 'lopez.fafutis@gmail.com' },
      data: { doctorId: 'cmjad41j600blmg0m1ziudezw' }
    });

    console.log('✅ Admin user linked to doctor profile:');
    console.log(`   Email: ${result.email}`);
    console.log(`   Role: ${result.role}`);
    console.log(`   DoctorId: ${result.doctorId}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

linkAdminToDoctor();
