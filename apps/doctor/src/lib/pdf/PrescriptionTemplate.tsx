import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2pt solid #333',
    paddingBottom: 10,
  },
  clinicName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  doctorInfo: {
    fontSize: 10,
    color: '#666',
  },
  patientSection: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#f5f5f5',
    padding: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  patientInfo: {
    fontSize: 10,
  },
  medicationsSection: {
    marginTop: 20,
  },
  medication: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: '1pt solid #e0e0e0',
  },
  medicationName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  medicationDetails: {
    fontSize: 10,
    marginBottom: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTop: '1pt solid #333',
    paddingTop: 10,
  },
  signature: {
    marginTop: 20,
    marginBottom: 10,
  },
  signatureImage: {
    width: 150,
    height: 50,
  },
  signatureLine: {
    borderTop: '1pt solid #333',
    width: 200,
    marginTop: 40,
    marginBottom: 5,
  },
  timestamp: {
    fontSize: 8,
    color: '#999',
    marginTop: 10,
  },
});

interface PrescriptionPDFProps {
  prescription: {
    id: string;
    prescriptionDate: string;
    doctorFullName: string;
    doctorLicense: string;
    doctorSignature?: string | null;
    diagnosis?: string | null;
    clinicalNotes?: string | null;
    patient: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      sex: string;
      internalId: string;
    };
    medications: Array<{
      drugName: string;
      presentation?: string | null;
      dosage: string;
      frequency: string;
      duration?: string | null;
      quantity?: string | null;
      instructions: string;
      warnings?: string | null;
    }>;
  };
  clinicInfo: {
    name: string;
    address?: string;
    phone?: string;
  };
}

export const PrescriptionPDF: React.FC<PrescriptionPDFProps> = ({
  prescription,
  clinicInfo
}) => {
  const patientAge = calculateAge(prescription.patient.dateOfBirth);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.clinicName}>{clinicInfo.name}</Text>
          <Text style={styles.doctorInfo}>
            Dr. {prescription.doctorFullName}
          </Text>
          <Text style={styles.doctorInfo}>
            Cédula Profesional: {prescription.doctorLicense}
          </Text>
          {clinicInfo.address && (
            <Text style={styles.doctorInfo}>{clinicInfo.address}</Text>
          )}
          {clinicInfo.phone && (
            <Text style={styles.doctorInfo}>Tel: {clinicInfo.phone}</Text>
          )}
        </View>

        {/* Patient Info */}
        <View style={styles.patientSection}>
          <Text style={styles.sectionTitle}>Información del Paciente</Text>
          <Text style={styles.patientInfo}>
            Paciente: {prescription.patient.firstName} {prescription.patient.lastName}
          </Text>
          <Text style={styles.patientInfo}>
            Edad: {patientAge} años • Sexo: {prescription.patient.sex}
          </Text>
          <Text style={styles.patientInfo}>
            ID: {prescription.patient.internalId}
          </Text>
          <Text style={styles.patientInfo}>
            Fecha: {formatDate(prescription.prescriptionDate)}
          </Text>
        </View>

        {/* Diagnosis */}
        {prescription.diagnosis && (
          <View style={{ marginBottom: 15 }}>
            <Text style={styles.sectionTitle}>Diagnóstico</Text>
            <Text style={{ fontSize: 10 }}>{prescription.diagnosis}</Text>
          </View>
        )}

        {/* Medications */}
        <View style={styles.medicationsSection}>
          <Text style={styles.sectionTitle}>Prescripción</Text>
          {prescription.medications.map((med, index) => (
            <View key={index} style={styles.medication}>
              <Text style={styles.medicationName}>
                {index + 1}. {med.drugName}
                {med.presentation && ` (${med.presentation})`}
              </Text>
              <Text style={styles.medicationDetails}>
                Dosis: {med.dosage}
              </Text>
              <Text style={styles.medicationDetails}>
                Frecuencia: {med.frequency}
              </Text>
              {med.duration && (
                <Text style={styles.medicationDetails}>
                  Duración: {med.duration}
                </Text>
              )}
              {med.quantity && (
                <Text style={styles.medicationDetails}>
                  Cantidad: {med.quantity}
                </Text>
              )}
              <Text style={styles.medicationDetails}>
                Indicaciones: {med.instructions}
              </Text>
              {med.warnings && (
                <Text style={[styles.medicationDetails, { color: '#d32f2f' }]}>
                  ⚠️ {med.warnings}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Clinical Notes */}
        {prescription.clinicalNotes && (
          <View style={{ marginTop: 15 }}>
            <Text style={styles.sectionTitle}>Notas Clínicas</Text>
            <Text style={{ fontSize: 10 }}>{prescription.clinicalNotes}</Text>
          </View>
        )}

        {/* Footer with Signature */}
        <View style={styles.footer}>
          <View style={styles.signature}>
            {prescription.doctorSignature ? (
              <Image
                src={prescription.doctorSignature}
                style={styles.signatureImage}
              />
            ) : (
              <View style={styles.signatureLine} />
            )}
            <Text style={{ fontSize: 10, marginTop: 5 }}>
              Dr. {prescription.doctorFullName}
            </Text>
            <Text style={{ fontSize: 9, color: '#666' }}>
              Cédula: {prescription.doctorLicense}
            </Text>
          </View>

          <Text style={styles.timestamp}>
            Prescripción ID: {prescription.id}
          </Text>
          <Text style={styles.timestamp}>
            Generado: {new Date().toLocaleString('es-MX')}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
