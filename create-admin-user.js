// Quick script to update user role to ADMIN
// Run with: node create-admin-user.js

const { PrismaClient } = require('@healthcare/database');

const prisma = new PrismaClient();

async function fixAdminRole() {
  try {
    console.log('Connecting to database...');

    // Check current user
    const currentUser = await prisma.user.findUnique({
      where: { email: 'lopez.fafutis@gmail.com' }
    });

    console.log('\n📋 Current user:', currentUser);

    if (!currentUser) {
      console.log('\n❌ User not found. Creating new ADMIN user...');

      const newUser = await prisma.user.create({
        data: {
          email: 'lopez.fafutis@gmail.com',
          name: 'Gerardo López',
          role: 'ADMIN',
          // doctorId can be null for admin users
        }
      });

      console.log('\n✅ Admin user created:', newUser);
    } else {
      console.log('\n🔄 Updating role to ADMIN...');

      const updatedUser = await prisma.user.update({
        where: { email: 'lopez.fafutis@gmail.com' },
        data: { role: 'ADMIN' }
      });

      console.log('\n✅ User updated:', updatedUser);
    }

    // List all users
    console.log('\n📊 All users:');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        doctorId: true,
      }
    });
    console.table(allUsers);

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminRole();
