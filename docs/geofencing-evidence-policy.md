# Diretrizes de Perímetro e Geofencing

O geofencing no PresençaFlow auxilia na verificação da localidade da marcação, mas não é usado como punição automática.

---

## Classificação de Localidade
- **INSIDE / OUTSIDE**: Marcação efetuada dentro ou fora do perímetro configurado para o funcionário.
- **UNCERTAIN**: Se a precisão do GPS (`accuracyMeters`) exceder 100 metros, a localidade é classificada como incerta para evitar falsos positivos.
- **Segurança Jurídica**: Nenhuma marcação fora do raio (`OUTSIDE`) bloqueia o salário ou gera sanções ao colaborador automaticamente. Ela apenas sinaliza a necessidade de revisão do gestor.
