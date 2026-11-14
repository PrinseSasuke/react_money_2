"""Report corrected nested training fractions on both available datasets."""
import json
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parent


def main():
    lines=['# Сравнение моделей с исправленными долями обучения','',
      'Обучающие подвыборки вложены и отбираются по целым прогонам. Для каждой номинальной доли '
      'общее число прогонов округляется до ближайшего целого; каждый сценарий представлен хотя бы одним прогоном. '
      'На малом проверенном наборе это ровно 6, 9 и 12 из 12 прогонов. Наличие некоторых сценариев '
      'только одним прогоном в обучении ограничивает выводы.', '',
      'MLP выбирает предел итераций из 50, 100 и 150 по независимой групповой validation; '
      'Transformer выбирает эпоху по той же группе. Пороговые правила обучаются на train. '
      'Показан Macro-F1: среднее ± стандартное отклонение по пяти разделениям после усреднения '
      'трёх seed внутри каждого. Окна и повторно используемые прогоны не независимы.', '']
    for title,folder in [('Малый набор с проверенными интервалами','verified_proportional'),
                         ('Исторический исследовательский набор','historical_proportional')]:
        path=ROOT/folder;config=json.loads((path/'config.json').read_text())
        if config['subset_mode']!='proportional' or config['mlp_selection']!='grouped':raise ValueError('wrong protocol')
        scores=pd.read_csv(path/'macro_f1_by_split.csv')
        lines += ['## '+title,'','| Модель | 50% | 75% | 100% |','|---|---:|---:|---:|']
        for model in ('rules','rf','mlp','transformer'):
            values=[]
            for fraction in (.5,.75,1.):
                row=scores[(scores.model==model)&(scores.fraction==fraction)&(~scores.temporal)].iloc[0]
                values.append(f"{row['mean']:.3f} ± {row['std']:.3f}")
            lines.append(f'| {model} | '+' | '.join(values)+' |')
        subsets=json.loads((path/'train_subsets.json').read_text())
        ranges={str(frac):[min(len(s['train_runs']) for s in subsets if s['fraction']==frac),
                           max(len(s['train_runs']) for s in subsets if s['fraction']==frac)] for frac in (.5,.75,1.)}
        lines+=['',f'Количество обучающих прогонов по разделениям: `{ranges}`.', '',
                f'![Зависимость качества от объёма]({folder}/learning_curves.png)', '']
    lines += ['Исторический набор остаётся исследовательским: timestamps исходных отсчётов и подтверждение '
      'инъекций отсутствуют, дополнительный lookback `rate()` не учитывался. Малый набор содержит '
      'четыре синтетических сценария и один стенд; распределение классов не отражает реальную частоту атак.', '',
      'Предсказания всех окон, составы разделений и подвыборок, параметры, матрицы и времена сохранены '
      'в соответствующих каталогах. Замеры времени выполнялись одновременно с другими задачами и не '
      'являются сравнительным бенчмарком. Предыдущие расчёты с округлением отдельно по сценариям '
      'сохранены для прослеживаемости и обозначены как номинальные доли.', '',
      'Для воспроизведения запустить `experiment_audited.py` с `--subset-mode proportional '
      '--mlp-selection grouped`, указав `--data` и `--out`, затем выполнить `summarize_audited.py` '
      'с теми же путями и `report_proportional.py`.']
    (ROOT/'PROPORTIONAL_RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print('\n'.join(lines))


if __name__=='__main__':main()
