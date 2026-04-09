export const CONTACT_NUMBER = "+91 9752224725";

export const getWhatsAppLink = (text) => {
  const cleanNumber = CONTACT_NUMBER.replace(/\D/g, '');
  return `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(text)}`;
};

export const getCallLink = () => {
  return `tel:${CONTACT_NUMBER.replace(/\s/g, '')}`;
};
